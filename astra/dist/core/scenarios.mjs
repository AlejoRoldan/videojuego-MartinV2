const setup = (id, name, keeper, wall, keeperPosition, wallPosition, advice) => Object.freeze({
  id, name, keeper, wall, keeperPosition, wallPosition, advice,
});

export const SCENARIOS = Object.freeze([
  setup('wall-left', 'Barrera a la izquierda', 550, 470, 'centrado', 'a la izquierda', 'El centro está cubierto: busca uno de los costados.'),
  setup('wall-right', 'Barrera a la derecha', 430, 635, 'a la izquierda', 'a la derecha', 'La barrera cierra la derecha y el arquero deja más espacio al otro lado.'),
  setup('wall-centre', 'Barrera en el centro', 680, 550, 'a la derecha', 'en el centro', 'El centro está bloqueado: decide entre rodear la barrera o elevar el tiro.'),
]);

export function scenarioAt(index) {
  const scenario = SCENARIOS[index];
  if (!scenario) throw new RangeError('Invalid scenario');
  return scenario;
}

export function snapshotScenario(index) {
  return Object.freeze({ ...scenarioAt(index) });
}

export function scenarioForMatch(match) {
  if (match?.outcome?.setup) return match.outcome.setup;
  return scenarioAt(match?.plan?.[match?.index]?.scenario);
}

export function describeScenario(scenario) {
  if (!scenario || typeof scenario !== 'object') throw new RangeError('Invalid scenario');
  return `${scenario.name}. Arquero ${scenario.keeperPosition}; barrera ${scenario.wallPosition}. ${scenario.advice}`;
}
