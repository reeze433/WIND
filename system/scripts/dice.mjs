export const ATTRIBUTES = ["wellbeing", "attention", "movement", "combat", "thinking", "communication"];
export function successes(face) {
  if (!Number.isInteger(face) || face < 1 || face > 6) throw new RangeError("Invalid d6 face");
  return face <= 3 ? 0 : face === 6 ? 2 : 1;
}
export function selectAttempt(attempts, mode = "normal") {
  if (!attempts.length || !["normal", "advantage", "disadvantage"].includes(mode)) throw new RangeError("Invalid attempts/mode");
  return attempts.reduce((best, a, i) => mode === "advantage" && a.total > attempts[best].total || mode === "disadvantage" && a.total < attempts[best].total ? i : best, 0);
}
export function validateCheck({pool, mode = "normal", repeats = 0, difficulty = null}) {
  if (!Number.isInteger(pool) || pool < 0 || pool > 100) throw new RangeError("Pool must be 0–100 (technical limit)");
  if (!["normal", "advantage", "disadvantage"].includes(mode) || !Number.isInteger(repeats) || repeats < 0 || repeats > 2) throw new RangeError("Invalid advantage/disadvantage");
  if (difficulty !== null && (!Number.isInteger(difficulty) || difficulty < 0)) throw new RangeError("Invalid difficulty");
  return {pool, mode, repeats: mode === "normal" ? 0 : repeats, difficulty};
}
