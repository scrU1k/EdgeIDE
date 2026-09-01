import { defineConfig, Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { exec, spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Cryptographically secure session token for native execution authorization
const serverSessionToken = crypto.randomBytes(24).toString('hex');

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
            const isLocal = origin.startsWith('http://localhost') || 
                            origin.startsWith('http://127.0.0.1') ||
                            origin.startsWith('https://localhost') ||
                            origin.startsWith('http://192.168.') ||
                            origin.startsWith('http://172.') ||
                            origin.startsWith('http://10.');
            if (!isLocal) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Forbidden: Origin is not trusted.' }));
              return;
            }
            res.setHeader('Access-Control-Allow-Origin', origin);
          } else {
            res.setHeader('Access-Control-Allow-Origin', '*');
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
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ token: serverSessionToken }));
            return;
          }

          // 1. Status Probe: Checks system Python and OS environment
          if (req.url === '/api/native-exec/status' && req.method === 'GET') {
            exec('python --version', (err, stdout, stderr) => {
              const pyVer = (stdout || stderr || '').trim();
              const hasPython = !err && pyVer.length > 0;
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                available: true,
                hasPython,
                pythonVersion: hasPython ? pyVer : 'Not found in PATH',
                platform: process.platform,
                osName: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux',
                cpuCores: os.cpus().length,
                totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024))
              }));
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

          // 2. Run Python Code on Host System
          if (req.url === '/api/native-exec/run' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const { code } = JSON.parse(body);
                const startTime = Date.now();
                const tmpFile = path.join(os.tmpdir(), `edgeide_${Date.now()}_run.py`);
                fs.writeFileSync(tmpFile, code || '', 'utf-8');

                const pyProc = spawn('python', ['-u', tmpFile]);
                let stdout = '';
                let stderr = '';

                pyProc.stdout.on('data', d => { stdout += d.toString(); });
                pyProc.stderr.on('data', d => { stderr += d.toString(); });

                pyProc.on('close', (code) => {
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

                proc.stdout.on('data', d => { output += d.toString(); });
                proc.stderr.on('data', d => { output += d.toString(); });

                proc.on('close', (exitCode) => {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ output, exitCode }));
                });

                proc.on('error', (err) => {
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
        // Handle CORS preflight from phone browser / Capacitor WebView
        if (req.method === 'OPTIONS' && (req.url?.startsWith('/api/p2p-relay'))) {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
          });
          res.end();
          return;
        }

        if (req.url === '/api/p2p-relay/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
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
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.writeHead(400, { 'Access-Control-Allow-Origin': '*' });
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
