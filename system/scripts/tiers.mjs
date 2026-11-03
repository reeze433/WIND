export const TIERS = {S: 5, A: 4, B: 3, C: 2, D: 1, E: 0};
export function tierModifier(tier) {
  if (!Object.hasOwn(TIERS, tier)) throw new RangeError("Invalid tier");
  return TIERS[tier];
}
export function damageForSuccesses(successes, tier) {
  if (!Number.isInteger(successes) || successes < 0) throw new RangeError("Invalid successes");
  return successes * tierModifier(tier);
}
