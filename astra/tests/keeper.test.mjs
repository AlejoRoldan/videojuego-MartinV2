import test from 'node:test';
import assert from 'node:assert/strict';
import { keeperPose } from '../dist/core/keeper.mjs';
import { resolveShot, SCENARIOS } from '../dist/core/physics.mjs';

const scene = SCENARIOS[0];

test('keeper follows a deterministic sports movement sequence', () => {
  const shot = resolveShot({ x: 550, y: 300, power: 72, spin: 0 }, 0);
  assert.equal(keeperPose(scene, shot, .04).phase, 'ready');
  assert.equal(keeperPose(scene, shot, .12).phase, 'read');
  assert.equal(keeperPose(scene, shot, .24).phase, 'plant');
  assert.equal(keeperPose(scene, shot, .55).phase, 'dive');
  assert.equal(keeperPose(scene, shot, .9).phase, 'contact');
  assert.deepEqual(keeperPose(scene, shot, .55), keeperPose(scene, shot, .55));
});

test('a saved shot finishes exactly at the leading glove', () => {
  const shot = resolveShot({ x: 550, y: 300, power: 72, spin: 0 }, 0);
  assert.equal(shot.type, 'save');
  const pose = keeperPose(scene, shot, 1);
  assert.deepEqual(pose.leadHand, { x: shot.contact.x, y: shot.contact.y });
});

test('keeper visibly misses a valid goal instead of catching it', () => {
  const shot = resolveShot({ x: 760, y: 230, power: 72, spin: 0 }, 0);
  assert.equal(shot.type, 'goal');
  const pose = keeperPose(scene, shot, 1);
  assert.ok(Math.hypot(pose.leadHand.x - shot.contact.x, pose.leadHand.y - shot.contact.y) > 20);
});

test('contact transitions through landing and recovery', () => {
  const shot = resolveShot({ x: 550, y: 300, power: 72, spin: 0 }, 0);
  assert.equal(keeperPose(scene, shot, 1, { resultAge: 100 }).phase, 'contact');
  assert.equal(keeperPose(scene, shot, 1, { resultAge: 350 }).phase, 'landing');
  assert.equal(keeperPose(scene, shot, 1, { resultAge: 800 }).phase, 'recovery');
});

test('invalid animation data is rejected without affecting physics', () => {
  assert.throws(() => keeperPose(null));
  assert.throws(() => keeperPose(scene, null, NaN));
  assert.throws(() => keeperPose(scene, null, 0, { resultAge: -1 }));
});
