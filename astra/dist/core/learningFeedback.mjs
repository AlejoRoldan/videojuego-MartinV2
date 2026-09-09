import { hint, label, validQuestion } from './math.mjs';

function validate(question) {
  if (!validQuestion(question)) throw new RangeError('Invalid question');
}

export function hintFeedback(question) {
  validate(question);
  return `Prueba con esta pista: ${hint(question)} No pierdes el turno.`;
}

export function errorFeedback(question, errorCount = 1) {
  validate(question);
  if (!Number.isInteger(errorCount) || errorCount < 1 || errorCount > 3) throw new RangeError('Invalid error count');
  const opening = errorCount === 1 ? 'Todavía no.' : `Llevas ${errorCount} intentos; puedes corregirlo.`;
  return `${opening} ${hint(question)} Vuelve a intentarlo; no pierdes el turno.`;
}

export function correctionFeedback(question, reward, clean) {
  validate(question);
  if (!Number.isInteger(reward) || reward < 0 || typeof clean !== 'boolean') throw new RangeError('Invalid correction');
  const opening = clean ? '¡Correcto!' : '¡Bien corregido!';
  return `${opening} ${label(question)} = ${question.answer}.${reward ? ` +${reward} XP.` : ''}`;
}

export function restoredLearningFeedback(match) {
  if (!match || match.phase !== 'question' || !match.helped) return '';
  const question = match.plan?.[match.index]?.question;
  return match.wrong?.length ? errorFeedback(question, match.wrong.length) : hintFeedback(question);
}
