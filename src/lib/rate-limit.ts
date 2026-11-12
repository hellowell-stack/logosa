/**
 * A coarse in-memory rate limit.
 *
 * Honest about its limits: the counter lives in one server process. On a
 * single long-running server that is the whole story; on a serverless host
 * each warm instance counts separately, so a determined attacker spread across
 * instances gets more attempts than the numbers here suggest. It still stops
 * the casual bot and the accidental double-submit, which is what it is for.
 * If abuse becomes real, move the counter to a shared store (Upstash, the
 * database) — every caller goes through `limited()`, so that is one change.
 */

const buckets = new Map<string, { n: number; until: number }>();

/** True when `key` has exceeded `limit` hits in the last `windowMs`. */
export function limited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const rec = buckets.get(key);
  if (!rec || now > rec.until) {
    buckets.set(key, { n: 1, until: now + windowMs });
    // Keep the map from growing without bound on a long-lived server.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now > v.until) buckets.delete(k);
    }
    return false;
  }
  rec.n += 1;
  return rec.n > limit;
}
