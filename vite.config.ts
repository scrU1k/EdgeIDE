import { defineConfig, Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';

function p2pSignalingPlugin(): Plugin {
  const clients = new Set<any>();

  return {
    name: 'p2p-signaling-relay',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
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
              res.writeHead(400);
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
    p2pSignalingPlugin()
  ],
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});
