import test from 'node:test';
import assert from 'node:assert/strict';
import { question } from '../dist/core/math.mjs';
import { createMatch, currentQuestion, reduceMatch } from '../dist/core/game.mjs';
import { correctionFeedback, errorFeedback, hintFeedback, restoredLearningFeedback } from '../dist/core/learningFeedback.mjs';

const step = (match, type, value) => reduceMatch(match, { type, value }).match;

test('multiplication feedback teaches groups or decomposition without stating the answer', () => {
  const groups = question(4, 3, 'multiply', () => 0);
  const decomposition = question(7, 8, 'multiply', () => 0);
  assert.match(hintFeedback(groups), /4 \+ 4 \+ 4/);
  assert.match(errorFeedback(decomposition), /7 × 5/);
  assert.doesNotMatch(errorFeedback(decomposition), /respuesta es/i);
});

test('division feedback uses the inverse relation and does not reveal the quotient', () => {
  const division = question(6, 7, 'divide', () => 0);
  const message = errorFeedback(division);
  assert.match(message, /6 × ¿qué número\? = 42/);
  assert.doesNotMatch(message, /= 7(?:\D|$)/);
});

test('two errors remain in the question and correction confirms the full equality once', () => {
  let match = createMatch({ seed: 9 });
  const current = currentQuestion(match);
  const wrong = current.options.filter(value => value !== current.answer);
  let update = reduceMatch(match, { type: 'ANSWER', value: wrong[0] });
  assert.equal(update.reward, 0); assert.equal(update.record, null); assert.equal(update.match.phase, 'question');
  match = update.match;
  update = reduceMatch(match, { type: 'ANSWER', value: wrong[1] });
  assert.equal(update.reward, 0); assert.equal(update.record, null); assert.equal(update.match.phase, 'question');
  assert.match(errorFeedback(current, update.match.wrong.length), /2 intentos/);
  match = update.match;
  update = reduceMatch(match, { type: 'ANSWER', value: current.answer });
  assert.equal(update.reward, 10); assert.equal(update.record.errors, 2); assert.equal(update.match.phase, 'aim');
  assert.equal(correctionFeedback(current, update.reward, update.record.clean), `¡Bien corregido! ${current.a} × ${current.b} = ${current.answer}. +10 XP.`);
  assert.equal(reduceMatch(update.match, { type: 'ANSWER', value: current.answer }).reward, 0);
});

test('feedback is reconstructed after reload from safe match state', () => {
  let match = createMatch({ seed: 4 });
  const current = currentQuestion(match);
  match = step(match, 'ANSWER', current.options.find(value => value !== current.answer));
  assert.equal(restoredLearningFeedback(structuredClone(match)), errorFeedback(current, 1));
  const hinted = step(createMatch({ seed: 5 }), 'HINT');
  assert.equal(restoredLearningFeedback(structuredClone(hinted)), hintFeedback(currentQuestion(hinted)));
  assert.equal(restoredLearningFeedback(createMatch()), '');
});
