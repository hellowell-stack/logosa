/**
 * The prayer-flag line strung across the opening.
 *
 * This module used to hold the procedural engine that drew illustrated
 * mountains in place of photographs. Every plate on the site is a photograph
 * now (see src/data/photos.ts), and the flags over the hero are all that is
 * still drawn.
 */

const f = (n: number) => Math.round(n * 100) / 100;

/** Prayer-flag line: a catenary between two points, with flags hung from it. */
export function prayerFlagLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sag: number,
  count: number,
) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + sag;
  const curve = `M${f(x1)} ${f(y1)}Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}`;

  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2,
    y: (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2,
  });

  // The five Tibetan Buddhist element colours, in their fixed traditional
  // order: blue (sky), white (air), red (fire), green (water), yellow (earth).
  const COLOURS = ["#2E6FA8", "#F4F1E8", "#C0392B", "#2F7D4F", "#FDB614"];
  const flags = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.6) / (count + 0.6);
    const p = at(t);
    const p2 = at(Math.min(1, t + 0.004));
    const angle = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
    flags.push({ ...p, angle, colour: COLOURS[i % 5], index: i });
  }
  return { curve, flags };
}
