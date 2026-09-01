import { defineConfig, Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { exec, spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

function nativeExecutionPlugin(): Plugin {
  return {
    name: 'native-execution-bridge',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // CORS headers for all native-exec endpoints
        if (req.url?.startsWith('/api/native-exec')) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
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
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          });
          res.write('\n');
          clients.add(res);

          req.on('close', () => {
            clients.delete(res);
          });
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
  }
});
