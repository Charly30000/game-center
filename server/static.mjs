import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
export async function serveFile(response, root, relative, { cache = false } = {}) {
  const base = resolve(root);
  const file = resolve(base, relative);
  if (!file.startsWith(base + sep)) { response.writeHead(403).end(); return; }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('No es un archivo.');
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': cache ? 'public, max-age=86400' : 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch { response.writeHead(404).end('No encontrado'); }
}
