import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const html = await readFile('dist/index.html', 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (!match[1].startsWith('#')) await readFile(resolve('dist', match[1]));
}
await readFile('dist/assets/stadium.webp');
const scripts = ['dist/game.js', 'dist/render.mjs', ...(await readdir('dist/core')).map(n => `dist/core/${n}`)];
for (const script of scripts) {
  const code = await readFile(script, 'utf8');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|\beval\(|new Function\(/.test(code), `Unsafe HTML/code sink in ${script}`);
  const result = spawnSync(process.execPath, ['--check', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
assert.match(html, /Content-Security-Policy/);
assert.ok(!/https?:\/\//.test(html), 'No external runtime assets expected');
assert.match(await readFile('dist/style.css', 'utf8'), /prefers-reduced-motion/);
console.log('PASS: script syntax, local assets, CSP, no dynamic HTML/code sinks, reduced motion.');
