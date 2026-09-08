import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlan } from '../dist/core/math.mjs';
import { createMatch, currentQuestion, reduceMatch } from '../dist/core/game.mjs';
import { DEFAULT_AIM, resolveShot } from '../dist/core/physics.mjs';
import { SCENARIOS, describeScenario, scenarioAt, scenarioForMatch } from '../dist/core/scenarios.mjs';

const step = (match, type, value) => reduceMatch(match, { type, value }).match;

test('HU-03 defines exactly three visible defensive configurations', () => {
  assert.equal(SCENARIOS.length, 3);
  assert.equal(new Set(SCENARIOS.map(scene => scene.id)).size, 3);
  assert.deepEqual(SCENARIOS.map(scene => [scene.keeperPosition, scene.wallPosition]), [
    ['centrado', 'a la izquierda'], ['a la izquierda', 'a la derecha'], ['a la derecha', 'en el centro'],
  ]);
  for (const scene of SCENARIOS) {
    const description = describeScenario(scene);
    assert.match(description, new RegExp(scene.keeperPosition));
    assert.match(description, new RegExp(scene.wallPosition));
    assert.ok(scene.advice.length > 20);
    assert.ok(Object.isFrozen(scene));
  }
});

test('scenario selection rotates reproducibly across the five shots', () => {
  const first = makePlan(0, 'multiply', 17).map(play => play.scenario);
  const second = makePlan(0, 'multiply', 17).map(play => play.scenario);
  assert.deepEqual(first, second);
  assert.deepEqual(first, [2, 0, 1, 2, 0]);
  assert.equal(new Set(first).size, 3);
});

test('shot freezes the advertised configuration for physics and rendering', () => {
  let match = createMatch({ seed: 3 });
  match = step(match, 'ANSWER', currentQuestion(match).answer);
  match = step(match, 'SHOOT');
  const snapshot = match.outcome.setup;
  assert.deepEqual(snapshot, scenarioAt(match.outcome.scenario));
  assert.ok(Object.isFrozen(snapshot));
  match.plan[match.index].scenario = (match.outcome.scenario + 1) % 3;
  assert.equal(match.outcome.setup.id, snapshot.id);
  assert.notEqual(match.outcome.setup.id, scenarioAt(match.plan[match.index].scenario).id);
  assert.equal(scenarioForMatch(match), snapshot);
});

test('aim starts centred, resets between shots and never guarantees five neutral goals', () => {
  let match = createMatch({ seed: 1 });
  assert.deepEqual(match.aim, DEFAULT_AIM);
  match = step(match, 'ANSWER', currentQuestion(match).answer);
  match = step(match, 'AIM', { x: 760, y: 230, power: 72, spin: 0 });
  match = step(match, 'SHOOT'); match = step(match, 'FINISH'); match = step(match, 'NEXT');
  assert.deepEqual(match.aim, DEFAULT_AIM);
  for (let start = 0; start < 3; start++) {
    const goals = Array.from({ length: 5 }, (_, index) => resolveShot(DEFAULT_AIM, (start + index) % 3).goal).filter(Boolean);
    assert.ok(goals.length < 5);
  }
});
