import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHARGE_MIN, CHARGE_MAX, chargePower, perfectWindow, powerGrade } from '../dist/core/power.mjs';

test('charge maps elapsed time to bounded deterministic power', () => {
  assert.equal(chargePower(0), CHARGE_MIN);
  assert.equal(chargePower(600), 65);
  assert.equal(chargePower(1200), CHARGE_MAX);
  assert.equal(chargePower(9000), CHARGE_MAX);
  assert.throws(() => chargePower(-1));
  assert.throws(() => chargePower(NaN));
});

test('clean mathematics widens the perfect execution window', () => {
  const clean = perfectWindow({ helped: false, wrong: [] });
  const assisted = perfectWindow({ helped: true, wrong: [] });
  const corrected = perfectWindow({ helped: true, wrong: [12] });
  assert.ok(clean.max - clean.min > assisted.max - assisted.min);
  assert.ok(assisted.max - assisted.min > corrected.max - corrected.min);
  assert.deepEqual(corrected, { min: 76, max: 82, kind: 'narrow' });
});

test('power feedback has explicit low, perfect, controlled and over bands', () => {
  const window = perfectWindow({ helped: false, wrong: [] });
  assert.equal(powerGrade(50, window), 'low');
  assert.equal(powerGrade(72, window), 'perfect');
  assert.equal(powerGrade(90, window), 'controlled');
  assert.equal(powerGrade(96, window), 'over');
});

test('aim UI exposes the active meter and removes the static power slider', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="powerMeter"[^>]+role="meter"/);
  assert.match(html, /id="shoot"[^>]+>MANTÉN PARA CARGAR</);
  assert.doesNotMatch(html, /id="power"\s+type="range"/);
});
