const KEY = "accounting-practice.v1";
export const freshStats = () => ({
  attempted: 0,
  completed: 0,
  assisted: 0,
  accuracy: {},
  missed: {},
});
export function validStats(s) {
  return (
    s &&
    ["attempted", "completed", "assisted"].every(
      (k) => Number.isSafeInteger(s[k]) && s[k] >= 0,
    ) &&
    s.accuracy &&
    s.missed &&
    Object.values(s.accuracy).every(
      (v) =>
        Number.isSafeInteger(v.correct) &&
        Number.isSafeInteger(v.total) &&
        v.correct >= 0 &&
        v.total >= v.correct,
    ) &&
    Object.values(s.missed).every((n) => Number.isSafeInteger(n) && n >= 0)
  );
}
export function load(storage) {
  try {
    const value = JSON.parse(storage.getItem(KEY) || "null");
    if (!value) return { stats: freshStats(), session: null };
    if (value.version !== 1 || !validStats(value.stats))
      throw Error("Invalid saved data");
    return value;
  } catch {
    return {
      stats: freshStats(),
      session: null,
      notice:
        "Saved progress is unavailable. You can still practice in this tab.",
    };
  }
}
export function save(storage, data) {
  try {
    storage.setItem(KEY, JSON.stringify({ version: 1, ...data }));
    return true;
  } catch {
    return false;
  }
}
// Only the first unassisted check of each section per attempt contributes to accuracy.
export function recordCheck(stats, session, section, result) {
  if (session.recorded[section] || session.revealed[section]) return;
  session.recorded[section] = true;
  const metric = (stats.accuracy[section] ??= { correct: 0, total: 0 });
  metric.correct += result.correct;
  metric.total += result.total;
  result.units
    .filter((u) => !u.ok)
    .forEach(
      (u) => (stats.missed[u.concept] = (stats.missed[u.concept] || 0) + 1),
    );
}
