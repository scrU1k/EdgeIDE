import { defineConfig, Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { exec, spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Cryptographically secure session token for native execution authorization
const serverSessionToken = crypto.randomBytes(24).toString('hex');

function isTrustedLocalOrigin(originHeader: string | undefined): boolean {
  if (!originHeader) return true; // Direct same-origin / non-browser requests
  try {
    const parsed = new URL(originHeader);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return true;
    }
    // RFC1918 Private IPv4 ranges
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    // Mobile WebView / local schemas
    if (parsed.protocol === 'capacitor:' || parsed.protocol === 'ionic:' || parsed.protocol === 'file:') return true;
  } catch {}
  return false;
}

function nativeExecutionPlugin(): Plugin {
  return {
    name: 'native-execution-bridge',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Security gate for all native execution endpoints
        if (req.url?.startsWith('/api/native-exec')) {
          const secFetchSite = req.headers['sec-fetch-site'];
          // Reject cross-site requests from untrusted external websites
          if (secFetchSite === 'cross-site') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden: Cross-site request rejected for security.' }));
            return;
          }

          // Validate Origin header if present
          const origin = req.headers['origin'];
          if (origin) {
            if (!isTrustedLocalOrigin(origin)) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Forbidden: Origin is not trusted.' }));
              return;
            }
            res.setHeader('Access-Control-Allow-Origin', origin);
          }

          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-EdgeIDE-Auth');

          if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
          }

          // 0. Session Auth Token Handshake (only accessible same-site / local)
          if (req.url === '/api/native-exec/session' && req.method === 'GET') {
            const remoteIp = req.socket?.remoteAddress;
            const isLocalhost = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
            
            if (!isLocalhost) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Forbidden: Session token only accessible from localhost.' }));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ token: serverSessionToken }));
            return;
          }

          // 1. Status Probe: Checks system Python, C/C++ compilers, and OS environment
          if (req.url === '/api/native-exec/status' && req.method === 'GET') {
            exec('python --version', (errPy, stdoutPy, stderrPy) => {
              const pyVer = (stdoutPy || stderrPy || '').trim();
              const hasPython = !errPy && pyVer.length > 0;

              exec('g++ --version', (errCpp, stdoutCpp) => {
                const hasCpp = !errCpp && (stdoutCpp || '').length > 0;
                const cppCompiler = 'g++';
                const cppVersion = (stdoutCpp || '').split('\n')[0].trim();

                const sendStatus = (hasCompiler: boolean, comp: string, ver: string) => {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    available: true,
                    hasPython,
                    pythonVersion: hasPython ? pyVer : 'Not found in PATH',
                    hasCpp: hasCompiler,
                    cppCompiler: hasCompiler ? comp : 'Not found in PATH',
                    cppVersion: hasCompiler ? ver : 'Not found in PATH',
                    platform: process.platform,
                    osName: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux',
                    cpuCores: os.cpus().length,
                    totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024))
                  }));
                };

                if (!hasCpp) {
                  exec('gcc --version', (errC, stdoutC) => {
                    const hasC = !errC && (stdoutC || '').length > 0;
                    sendStatus(hasC, 'gcc', (stdoutC || '').split('\n')[0].trim());
                  });
                  return;
                }

                sendStatus(true, cppCompiler, cppVersion);
              });
            });
            return;
          }

          // Verify token for execution endpoints (run & shell)
          const clientToken = req.headers['x-edgeide-auth'];
          if (req.url === '/api/native-exec/run' || req.url === '/api/native-exec/shell') {
            if (!clientToken || clientToken !== serverSessionToken) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing authorization token.' }));
              return;
            }
          }

          // 2. Run Code on Host System (Python, C++, C)
          if (req.url === '/api/native-exec/run' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const { code, language = 'python', filename } = JSON.parse(body);
                const startTime = Date.now();
                const uniqueId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

                // A. C / C++ Compilation & Native Execution
                if (language === 'cpp' || language === 'c') {
                  const isCpp = language !== 'c';
                  const ext = isCpp ? 'cpp' : 'c';
                  const srcFile = path.join(os.tmpdir(), `edgeide_${uniqueId}.${ext}`);
                  const exeFile = path.join(os.tmpdir(), `edgeide_${uniqueId}_bin` + (process.platform === 'win32' ? '.exe' : ''));
                  fs.writeFileSync(srcFile, code || '', 'utf-8');

                  const compiler = isCpp ? 'g++' : 'gcc';
                  const stdFlag = isCpp ? '-std=c++14' : '-std=c11';
                  const compileCmd = `${compiler} -O2 ${stdFlag} "${srcFile}" -o "${exeFile}"`;

                  exec(compileCmd, (compileErr, compileStdout, compileStderr) => {
                    if (compileErr) {
                      try { fs.unlinkSync(srcFile); } catch {}
                      try { fs.unlinkSync(exeFile); } catch {}

                      // Clean up internal temp paths so user sees clean filename
                      const displayName = filename || `main.${ext}`;
                      const cleanStderr = (compileStderr || compileStdout || 'Compilation failed.').replace(
                        new RegExp(srcFile.replace(/\\/g, '\\\\'), 'g'),
                        displayName
                      );

                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({
                        success: false,
                        stdout: compileStdout || '',
                        stderr: cleanStderr,
                        exitCode: compileErr.code || 1,
                        executionTimeMs: Date.now() - startTime
                      }));
                      return;
                    }

                    // Execution phase
                    const proc = spawn(exeFile);
                    let stdout = '';
                    let stderr = '';
                    let isCompleted = false;

                    const INACTIVITY_TIMEOUT_MS = 30000;
                    let watchdogTimer = setTimeout(onTimeout, INACTIVITY_TIMEOUT_MS);

                    function resetWatchdog() {
                      if (isCompleted) return;
                      clearTimeout(watchdogTimer);
                      watchdogTimer = setTimeout(onTimeout, INACTIVITY_TIMEOUT_MS);
                    }

                    function onTimeout() {
                      if (isCompleted) return;
                      isCompleted = true;
                      try { proc.kill('SIGKILL'); } catch {}
                      try { fs.unlinkSync(srcFile); } catch {}
                      try { fs.unlinkSync(exeFile); } catch {}
                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({
                        success: false,
                        stdout,
                        stderr: (stderr ? stderr + '\n' : '') + 'Execution timed out (exceeded 30s inactivity limit).',
                        exitCode: 124,
                        executionTimeMs: Date.now() - startTime
                      }));
                    }

                    proc.stdout.on('data', d => {
                      stdout += d.toString();
                      resetWatchdog();
                    });
                    proc.stderr.on('data', d => {
                      stderr += d.toString();
                      resetWatchdog();
                    });

                    proc.on('close', (code) => {
                      if (isCompleted) return;
                      isCompleted = true;
                      clearTimeout(watchdogTimer);
                      try { fs.unlinkSync(srcFile); } catch {}
                      try { fs.unlinkSync(exeFile); } catch {}
                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({
                        success: code === 0,
                        stdout,
                        stderr,
                        exitCode: code,
                        executionTimeMs: Date.now() - startTime
                      }));
                    });

                    proc.on('error', (err) => {
                      if (isCompleted) return;
                      isCompleted = true;
                      clearTimeout(watchdogTimer);
                      try { fs.unlinkSync(srcFile); } catch {}
                      try { fs.unlinkSync(exeFile); } catch {}
                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({
                        success: false,
                        stdout,
                        stderr: err.message,
                        exitCode: 1,
                        executionTimeMs: Date.now() - startTime
                      }));
                    });
                  });
                  return;
                }

                // B. Python Execution
                const tmpFile = path.join(os.tmpdir(), `edgeide_${uniqueId}_run.py`);
                fs.writeFileSync(tmpFile, code || '', 'utf-8');

                const pyProc = spawn('python', ['-u', tmpFile]);
                let stdout = '';
                let stderr = '';
                let isCompleted = false;

                // Activity watchdog: resets whenever output is produced
                const INACTIVITY_TIMEOUT_MS = 30000;
                let watchdogTimer = setTimeout(onTimeout, INACTIVITY_TIMEOUT_MS);

                function resetWatchdog() {
                  if (isCompleted) return;
                  clearTimeout(watchdogTimer);
                  watchdogTimer = setTimeout(onTimeout, INACTIVITY_TIMEOUT_MS);
                }

                function onTimeout() {
                  if (isCompleted) return;
                  isCompleted = true;
                  try { pyProc.kill('SIGKILL'); } catch {}
                  try { fs.unlinkSync(tmpFile); } catch {}
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: false,
                    stdout,
                    stderr: (stderr ? stderr + '\n' : '') + 'Execution timed out (exceeded 30s inactivity limit).',
                    exitCode: 124,
                    executionTimeMs: Date.now() - startTime
                  }));
                }

                pyProc.stdout.on('data', d => {
                  stdout += d.toString();
                  resetWatchdog();
                });
                pyProc.stderr.on('data', d => {
                  stderr += d.toString();
                  resetWatchdog();
                });

                pyProc.on('close', (code) => {
                  if (isCompleted) return;
                  isCompleted = true;
                  clearTimeout(watchdogTimer);
                  try { fs.unlinkSync(tmpFile); } catch {}
                  const duration = Date.now() - startTime;
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: code === 0,
                    stdout,
                    stderr,
                    exitCode: code,
                    executionTimeMs: duration
                  }));
                });

                pyProc.on('error', (err) => {
                  if (isCompleted) return;
                  isCompleted = true;
                  clearTimeout(watchdogTimer);
                  try { fs.unlinkSync(tmpFile); } catch {}
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: false,
                    stdout: '',
                    stderr: `Failed to execute system python: ${err.message}`,
                    exitCode: 1,
                    executionTimeMs: Date.now() - startTime
                  }));
                });
              } catch (e: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }

          // 3. Run Native Shell Command (PowerShell on Win, Zsh/Bash on Mac/Linux)
          if (req.url === '/api/native-exec/shell' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const { command } = JSON.parse(body);
                const isWin = process.platform === 'win32';
                const shellCmd = isWin ? 'powershell.exe' : '/bin/sh';
                const shellArgs = isWin ? ['-NoProfile', '-Command', command] : ['-c', command];

                const proc = spawn(shellCmd, shellArgs);
                let output = '';
                let isCompleted = false;

                // 2-minute activity watchdog (resets on active pip download/build output)
                const SHELL_TIMEOUT_MS = 120000;
                let watchdogTimer = setTimeout(onTimeout, SHELL_TIMEOUT_MS);

                function resetWatchdog() {
                  if (isCompleted) return;
                  clearTimeout(watchdogTimer);
                  watchdogTimer = setTimeout(onTimeout, SHELL_TIMEOUT_MS);
                }

                function onTimeout() {
                  if (isCompleted) return;
                  isCompleted = true;
                  try { proc.kill('SIGKILL'); } catch {}
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    output: (output ? output + '\n' : '') + 'Command timed out (exceeded inactivity limit).',
                    exitCode: 124
                  }));
                }

                proc.stdout.on('data', d => {
                  output += d.toString();
                  resetWatchdog();
                });
                proc.stderr.on('data', d => {
                  output += d.toString();
                  resetWatchdog();
                });

                proc.on('close', (exitCode) => {
                  if (isCompleted) return;
                  isCompleted = true;
                  clearTimeout(watchdogTimer);
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ output, exitCode }));
                });

                proc.on('error', (err) => {
                  if (isCompleted) return;
                  isCompleted = true;
                  clearTimeout(watchdogTimer);
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ output: `Shell error: ${err.message}`, exitCode: 1 }));
                });
              } catch (e: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }
        }

        next();
      });
    }
  };
}

function p2pSignalingPlugin(): Plugin {
  const clients = new Set<any>();

  return {
    name: 'p2p-signaling-relay',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const origin = req.headers['origin'];
        const isAllowedOrigin = isTrustedLocalOrigin(origin);

        // Handle CORS preflight from phone browser / Capacitor WebView
        if (req.method === 'OPTIONS' && (req.url?.startsWith('/api/p2p-relay'))) {
          if (!isAllowedOrigin && origin) {
            res.writeHead(403);
            res.end();
            return;
          }
          res.writeHead(204, {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
          });
          res.end();
          return;
        }

        if (req.url?.startsWith('/api/p2p-relay')) {
          if (!isAllowedOrigin && origin) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden: Untrusted origin' }));
            return;
          }
          if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
          }
        }

        if (req.url === '/api/p2p-relay/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            ...(origin ? { 'Access-Control-Allow-Origin': origin } : {})
          });
          res.write('\n');
          clients.add(res);

          const cleanup = () => { clients.delete(res); };
          req.on('close', cleanup);
          req.on('end', cleanup);
          res.on('error', cleanup);
          return;
        }

        if (req.url === '/api/p2p-relay/send' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const eventPayload = `data: ${JSON.stringify(data)}\n\n`;
              for (const client of clients) {
                try {
                  client.write(eventPayload);
                } catch {
                  clients.delete(client);
                }
              }
              res.writeHead(200, {
                'Content-Type': 'application/json',
                ...(origin ? { 'Access-Control-Allow-Origin': origin } : {})
              });
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.writeHead(400, {
                ...(origin ? { 'Access-Control-Allow-Origin': origin } : {})
              });
              res.end();
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [
    tailwindcss(),
    p2pSignalingPlugin(),
    nativeExecutionPlugin()
  ],
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@codemirror') || id.includes('@lezer') || id.includes('style-mod') || id.includes('w3c-keyname')) {
            return 'vendor-codemirror';
          }
          if (id.includes('isomorphic-git') || id.includes('buffer')) {
            return 'vendor-git';
          }
          if (id.includes('qrcode') || id.includes('jsqr')) {
            return 'vendor-sharing';
          }
        }
      }
    }
  }
});
