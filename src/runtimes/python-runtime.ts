import { LanguageRuntime, ConsoleMessage, ExecutionResult } from './types';
import { VirtualFileSystem } from '../vfs/vfs';

const PYODIDE_WORKER_SCRIPT = `
let pyodide = null;
let initPromise = null;
let installedPackages = new Set(['micropip', 'packaging']);
let stdinQueue = [];
let networkAllowed = true;

// In web workers, provide dummy document and ImageData so libraries expecting DOM (like matplotlib_pyodide) don't crash
if (typeof self.document === 'undefined') {
  self.document = {
    createElement: function() {
      return {
        getContext: function() { return null; },
        setAttribute: function() {},
        style: {}
      };
    },
    getElementById: function() { return null; },
    body: { appendChild: function() {}, removeChild: function() {} }
  };
}
if (typeof self.ImageData === 'undefined') {
  self.ImageData = function(w, h) {
    this.width = w || 0;
    this.height = h || 0;
    this.data = new Uint8ClampedArray((w || 0) * (h || 0) * 4);
  };
}

// Sandbox lockdown: Prevent exfiltration and origin storage access via Pyodide JS interop
const restrictedKeys = ['indexedDB', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'caches', 'Worker', 'SharedWorker'];
for (const key of restrictedKeys) {
  try {
    Object.defineProperty(self, key, {
      get() { throw new Error('Security Exception: Access to ' + key + ' is blocked in this sandbox.'); },
      configurable: false
    });
  } catch (err) {}
}

// Proxy fetch to only allow Pyodide and PyPI downloads using strict hostname matching.
const originalFetch = self.fetch;
Object.defineProperty(self, 'fetch', {
  value: async function(url, options) {
    if (!networkAllowed) {
      throw new Error('Network access is disabled (Net: Off). Toggle "Net: On" in the panel toolbar to allow network requests.');
    }
    const urlStr = String(url);
    let allowed = false;
    try {
      const parsed = new URL(urlStr);
      const h = parsed.hostname.toLowerCase();
      // Allow local app origin (bundled offline Pyodide / assets) as well as safe external CDNs
      const isLocal = self.location && parsed.origin === self.location.origin;
      const allowedHosts = ['cdn.jsdelivr.net', 'pypi.org', 'files.pythonhosted.org'];
      if (isLocal || allowedHosts.includes(h)) {
        // Only allow safe read-only methods to prevent outbound data exfiltration.
        const method = ((options && options.method) || 'GET').toUpperCase();
        if (method === 'GET' || method === 'HEAD') {
          allowed = true;
        }
      }
    } catch {}
    if (!allowed) {
      throw new Error('Security Exception: fetch is restricted to local offline assets, PyPI, and jsDelivr CDN (GET/HEAD only) in this sandbox.');
    }
    return originalFetch.apply(this, arguments);
  },
  configurable: false,
  writable: false
});

async function getPyodide() {
  if (pyodide) return pyodide;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    postMessage({ type: 'msg', msgType: 'system', text: 'Loading Pyodide CPython WebAssembly engine...' });
    
    // 1. First attempt to load bundled offline Pyodide assets if available
    let loadedOffline = false;
    if (typeof self !== 'undefined' && self.location && self.location.origin) {
      const localBase = self.location.origin + '/pyodide/';
      try {
        importScripts(localBase + 'pyodide.js');
        pyodide = await loadPyodide({
          indexURL: localBase
        });
        loadedOffline = true;
      } catch (localErr) {
        // Local bundled assets not present; fall back to CDN
      }
    }

    // 2. If not bundled locally, load from CDN (only if network is permitted)
    if (!loadedOffline) {
      if (!networkAllowed) {
        initPromise = null;
        throw new Error('Network access is disabled (Net: Off). Cannot load Pyodide from CDN while offline. Bundle Pyodide assets locally in public/pyodide/ or toggle "Net: On" for the initial download.');
      }
      try {
        importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js");
        
        pyodide = await loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/"
        });
      } catch (netErr) {
        initPromise = null;
        throw new Error('Failed to load Pyodide WebAssembly. If offline, bundle Pyodide assets locally or enable "Net: On" for the initial load: ' + (netErr && netErr.message ? netErr.message : netErr));
      }
    }

    // Configure standard output
    pyodide.setStdout({
      batched: (text) => {
        postMessage({ type: 'msg', msgType: 'stdout', text });
      }
    });

    // Configure standard error
    pyodide.setStderr({
      batched: (text) => {
        postMessage({ type: 'msg', msgType: 'stderr', text });
      }
    });

    // Configure standard input to resolve OSError [Errno 29] I/O error on input()
    pyodide.setStdin({
      isatty: true,
      stdin: () => {
        if (stdinQueue.length > 0) {
          const val = stdinQueue.shift();
          postMessage({ type: 'msg', msgType: 'stdout', text: val });
          return val + '\\n';
        }
        return '\\n';
      }
    });

    // Configure matplotlib headless environment and show() interceptor in Web Worker
    try {
      await pyodide.runPythonAsync(
        "import sys\\n" +
        "import io\\n" +
        "import os\\n" +
        "import base64\\n" +
        "os.environ['MPLBACKEND'] = 'Agg'\\n" +
        "def _setup_matplotlib_support():\\n" +
        "    try:\\n" +
        "        import matplotlib\\n" +
        "        matplotlib.use('Agg')\\n" +
        "        import matplotlib.pyplot as plt\\n" +
        "        def custom_show(*args, **kwargs):\\n" +
        "            try:\\n" +
        "                figures = [plt.figure(i) for i in plt.get_fignums()]\\n" +
        "                if not figures and plt.get_fignums():\\n" +
        "                    figures = [plt.gcf()]\\n" +
        "                for fig in figures:\\n" +
        "                    buf = io.BytesIO()\\n" +
        "                    fig.savefig(buf, format='png', bbox_inches='tight', dpi=100)\\n" +
        "                    buf.seek(0)\\n" +
        "                    img_b64 = base64.b64encode(buf.read()).decode('ascii')\\n" +
        "                    print('\\n__EDGEIDE_IMAGE_PNG__' + img_b64 + '__EDGEIDE_IMAGE_END__\\n')\\n" +
        "                    plt.close(fig)\\n" +
        "            except Exception as e:\\n" +
        "                print(f'[Matplotlib rendering notice: {e}]', file=sys.stderr)\\n" +
        "        plt.show = custom_show\\n" +
        "    except ImportError:\\n" +
        "        pass\\n" +
        "_setup_matplotlib_support()\\n"
      );
    } catch (e) {
      // matplotlib not loaded yet, will hook dynamically on execution if imported
    }

    postMessage({ type: 'msg', msgType: 'system', text: 'Python 3.12 (Pyodide WASM Worker) Ready' });
    return pyodide;
  })();

  return initPromise;
}

onmessage = async (e) => {
  const { type, code, files, packages, inputs, allowed } = e.data;

  if (type === 'set_network') {
    networkAllowed = !!allowed;
    return;
  }

  if (type === 'stdin_input') {
    if (e.data.value !== undefined) {
      stdinQueue.push(String(e.data.value));
    }
    return;
  }

  if (type === 'run') {
    const startTime = performance.now();
    try {
      const py = await getPyodide();

      // Setup inputs queue for this execution
      stdinQueue = Array.isArray(inputs) ? [...inputs] : [];

      // Sync files into Pyodide virtual filesystem
      if (files && Array.isArray(files)) {
        for (const file of files) {
          try {
            py.FS.writeFile(file.name, file.content, { encoding: 'utf8' });
          } catch(err) {}
        }
      }

      // Auto-load packages used in the code (e.g. matplotlib, numpy, pandas)
      try {
        await py.loadPackagesFromImports(code);
      } catch (loadErr) {}

      // Prepend matplotlib setup: force-stub matplotlib_pyodide and purge cached matplotlib
      // so that pyplot re-initialises with the pure Agg backend (no DOM/browser APIs needed).
      let codeToExecute = code;
      if (/import[\s\S]*?matplotlib|from[\s\S]*?matplotlib/m.test(code)) {
        const mplSetup =
          "import sys as _sys, io as _io, os as _os, base64 as _base64, types as _types\\n" +
          "_os.environ['MPLBACKEND'] = 'agg'\\n" +
          "# Force-overwrite matplotlib_pyodide with empty stubs (even if already cached)\\n" +
          "for _smod in ['matplotlib_pyodide', 'matplotlib_pyodide.wasm_backend', 'matplotlib_pyodide.browser_backend', 'matplotlib.backends.backend_wasm']:\\n" +
          "    _stub = _types.ModuleType(_smod)\\n" +
          "    for _a in ['FigureCanvas', 'FigureManager', 'new_figure_manager', 'show', 'backend', '_backend_mod']:\\n" +
          "        setattr(_stub, _a, None)\\n" +
          "    _sys.modules[_smod] = _stub\\n" +
          "# Purge ALL cached matplotlib so pyplot reloads with our env/stubs in effect\\n" +
          "for _k in list(_sys.modules.keys()):\\n" +
          "    if 'matplotlib' in _k and 'matplotlib_pyodide' not in _k:\\n" +
          "        del _sys.modules[_k]\\n" +
          "import matplotlib as _mpl\\n" +
          "_mpl.use('agg')\\n" +
          "import matplotlib.pyplot as _plt\\n" +
          "def _edgeide_show(*_a, **_kw):\\n" +
          "    try:\\n" +
          "        for _fn in _plt.get_fignums():\\n" +
          "            _fig = _plt.figure(_fn)\\n" +
          "            _buf = _io.BytesIO()\\n" +
          "            _fig.savefig(_buf, format='png', bbox_inches='tight', dpi=100)\\n" +
          "            _buf.seek(0)\\n" +
          "            _b64 = _base64.b64encode(_buf.read()).decode('ascii')\\n" +
          "            print('\\\\n__EDGEIDE_IMAGE_PNG__' + _b64 + '__EDGEIDE_IMAGE_END__\\\\n')\\n" +
          "            _plt.close(_fig)\\n" +
          "    except Exception as _e:\\n" +
          "        print('[Matplotlib render error: ' + str(_e) + ']', file=_sys.stderr)\\n" +
          "_plt.show = _edgeide_show\\n";
        codeToExecute = mplSetup + code;
      }

      // Execute Python asynchronously in background worker thread
      const result = await py.runPythonAsync(codeToExecute);
      const executionTimeMs = performance.now() - startTime;

      let resultStr = null;
      if (result !== undefined && result !== null) {
        const s = String(result);
        if (s !== 'None') {
          resultStr = s;
        }
      }

      postMessage({
        type: 'done',
        success: true,
        result: resultStr,
        executionTimeMs
      });
    } catch(err) {
      const executionTimeMs = performance.now() - startTime;
      postMessage({
        type: 'done',
        success: false,
        error: err?.message || String(err),
        executionTimeMs
      });
    }
  } else if (type === 'pip_install') {
    try {
      const py = await getPyodide();
      for (const pkg of (packages || [])) {
        const cleanPkg = String(pkg).trim().toLowerCase();
        postMessage({ type: 'pip_log', text: 'Collecting ' + cleanPkg + '...' });

        let loaded = false;
        // 1. First attempt: Load pre-compiled WASM package from Pyodide CDN (matplotlib, numpy, scipy, pandas, sympy, etc.)
        try {
          await py.loadPackage(cleanPkg, {
            messageCallback: (msg) => postMessage({ type: 'pip_log', text: String(msg) }),
            errorCallback: (err) => postMessage({ type: 'pip_log', text: String(err) })
          });
          installedPackages.add(cleanPkg);
          loaded = true;
          postMessage({ type: 'pip_log', text: 'Successfully installed ' + cleanPkg + ' (Pyodide WASM)' });
        } catch (wasmErr) {
          // If not in Pyodide built-in distribution, fallback to micropip from PyPI
        }

        // 2. Second attempt: micropip for pure Python wheels on PyPI
        if (!loaded) {
          try {
            await py.loadPackage('micropip');
            const micropip = py.pyimport('micropip');
            postMessage({ type: 'pip_log', text: 'Searching PyPI for ' + cleanPkg + '...' });
            await micropip.install(cleanPkg);
            installedPackages.add(cleanPkg);
            postMessage({ type: 'pip_log', text: 'Successfully installed ' + cleanPkg + ' from PyPI' });
            loaded = true;
          } catch (pipErr) {
            throw new Error('Could not install ' + cleanPkg + ': ' + (pipErr && pipErr.message ? pipErr.message : pipErr));
          }
        }
      }
      postMessage({ type: 'pip_done', success: true });
    } catch(err) {
      postMessage({ type: 'pip_done', success: false, error: err?.message || String(err) });
    }
  } else if (type === 'pip_list') {
    let allPkgs = Array.from(installedPackages);
    if (pyodide && pyodide.loadedPackages) {
      for (const k of Object.keys(pyodide.loadedPackages)) {
        if (!allPkgs.includes(k)) allPkgs.push(k);
      }
    }
    postMessage({ type: 'pip_list_res', packages: allPkgs.sort() });
  }
};
`;

export class PythonRuntime implements LanguageRuntime {
  public id = 'pyodide';
  public name = 'Python 3.12 (Pyodide WASM)';
  public supportedLanguages = ['python' as const];

  private worker: Worker | null = null;
  private currentReject: ((reason?: any) => void) | null = null;
  private networkAllowed: boolean = true;

  public isReady(): boolean {
    return this.worker !== null;
  }

  public setNetworkAllowed(allowed: boolean): void {
    this.networkAllowed = allowed;
    if (this.worker) {
      this.worker.postMessage({ type: 'set_network', allowed });
    }
  }

  public isNetworkAllowed(): boolean {
    return this.networkAllowed;
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      const blob = new Blob([PYODIDE_WORKER_SCRIPT], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      this.worker = new Worker(blobUrl);
      URL.revokeObjectURL(blobUrl);
      // Synchronize current network allowed state with new worker
      this.worker.postMessage({ type: 'set_network', allowed: this.networkAllowed });
    }
    return this.worker;
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.currentReject) {
      this.currentReject(new Error('Execution terminated by user'));
      this.currentReject = null;
    }
  }

  public async run(
    code: string, 
    vfs: VirtualFileSystem, 
    onOutput: (msg: ConsoleMessage) => void,
    inputs?: string[]
  ): Promise<ExecutionResult> {
    const outputs: ConsoleMessage[] = [];
    const pushMsg = (type: ConsoleMessage['type'], text: string) => {
      const msg: ConsoleMessage = {
        id: 'msg_' + Math.random().toString(36).substring(2, 8),
        type,
        text,
        timestamp: Date.now()
      };
      outputs.push(msg);
      onOutput(msg);
    };

    const worker = this.ensureWorker();

    return new Promise<ExecutionResult>((resolve, reject) => {
      this.currentReject = reject;

      const handleMessage = (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'msg') {
          pushMsg(data.msgType, data.text);
        } else if (data.type === 'done') {
          worker.removeEventListener('message', handleMessage);
          this.currentReject = null;

          if (data.success) {
            if (data.result) {
              pushMsg('result', '=> ' + data.result);
            }
            resolve({
              success: true,
              outputs,
              executionTimeMs: data.executionTimeMs || 0
            });
          } else {
            pushMsg('error', data.error);
            resolve({
              success: false,
              outputs,
              executionTimeMs: data.executionTimeMs || 0,
              error: data.error
            });
          }
        }
      };

      worker.addEventListener('message', handleMessage);

      const allFiles = vfs.getAllFiles().map(f => ({ name: f.name, content: f.content }));
      worker.postMessage({
        type: 'run',
        code,
        files: allFiles,
        inputs: inputs || []
      });
    });
  }

  public async runStreaming(
    code: string,
    vfs: VirtualFileSystem,
    onStdout: (out: string) => void,
    onStderr: (err: string) => void,
    inputs?: string[]
  ): Promise<string | null> {
    const worker = this.ensureWorker();

    return new Promise<string | null>((resolve, reject) => {
      this.currentReject = reject;

      const handleMessage = (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'msg') {
          if (data.msgType === 'stdout' || data.msgType === 'result') {
            onStdout(data.text + '\r\n');
          } else if (data.msgType === 'stderr' || data.msgType === 'error') {
            onStderr(data.text + '\r\n');
          }
        } else if (data.type === 'done') {
          worker.removeEventListener('message', handleMessage);
          this.currentReject = null;
          if (data.success) {
            resolve(data.result);
          } else {
            reject(new Error(data.error));
          }
        }
      };

      worker.addEventListener('message', handleMessage);

      const allFiles = vfs.getAllFiles().map(f => ({ name: f.name, content: f.content }));
      worker.postMessage({
        type: 'run',
        code,
        files: allFiles,
        inputs: inputs || []
      });
    });
  }

  public async pipInstall(packages: string[], onLog: (log: string) => void): Promise<void> {
    const worker = this.ensureWorker();

    return new Promise<void>((resolve, reject) => {
      const handleMessage = (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'pip_log') {
          onLog(data.text);
        } else if (data.type === 'msg') {
          onLog(data.text);
        } else if (data.type === 'pip_done') {
          worker.removeEventListener('message', handleMessage);
          if (data.success) {
            resolve();
          } else {
            reject(new Error(data.error));
          }
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({
        type: 'pip_install',
        packages
      });
    });
  }

  public async pipList(): Promise<string[]> {
    const worker = this.ensureWorker();

    return new Promise<string[]>((resolve) => {
      const handleMessage = (e: MessageEvent) => {
        const data = e.data;
        if (data && data.type === 'pip_list_res') {
          worker.removeEventListener('message', handleMessage);
          resolve(data.packages || ['micropip', 'packaging']);
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({ type: 'pip_list' });
    });
  }
}
