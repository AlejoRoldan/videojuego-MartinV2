// Dependency-free local preview; deployment uses static assets only.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 4173);
const types = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json' };
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (['/qa/mobile', '/qa/mobile360'].includes(pathname)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(('<!doctype html><html><head><title>Mobile QA</title></head><body style="margin:0;background:#ccc"><iframe title="GOL LAB móvil" src="/" width="390" height="844" style="border:0"></iframe></body></html>').replace('width="390" height="844"', pathname.endsWith('360') ? 'width="360" height="800"' : 'width="390" height="844"')); return; }
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`GOL LAB preview ready on ${port}`));
