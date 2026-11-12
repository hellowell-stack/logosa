"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import nepal from "@/data/nepal-boundary.json";
import { mapChapters, routeCoords } from "@/data/map-journey";
import { smoothPath, type Coord } from "@/lib/mapbox/journey";
import {
  registerGsap,
  ScrollTrigger,
  prefersReducedMotion,
  useReducedMotion,
} from "@/lib/animations/motion";
import { pad2 } from "@/lib/utils";

/**
 * THE DRAWN ATLAS.
 *
 * Shown when there is no Mapbox token, when WebGL is unavailable, or when the
 * visitor has asked for reduced motion. It is not a placeholder: the boundary
 * is real Natural Earth geometry, the destinations are at their true
 * coordinates, and it tells the same story from the same data.
 *
 * Every position is projected properly, so a place plotted here is where it
 * actually is — which is the whole difference between an atlas and a diagram.
 */

/**
 * The frame is cut close to the country. Nepal is nearly twice as wide as it
 * is tall, so on a phone the map is limited by the width of the screen and
 * every unit of padding in here comes straight off the size it is drawn at.
 */
const W = 1060;
const H = 590;
const PAD = 26;

type Ring = number[][];
const ring = (nepal as { coordinates: Ring[] }).coordinates[0] as Ring;

/**
 * The northern skyline of the country: for each column of longitude, the
 * highest latitude the boundary reaches there.
 *
 * The obvious way to get the northern border is to walk the ring from its
 * westernmost vertex to its easternmost one — but Nepal's easternmost point is
 * in the far *south*-east, at the Mechi corner, so that walk comes back down
 * the eastern border and the hachure drawn from it knots up over the Khumbu.
 * Sampling by column has no such trap, and it returns a chain that only ever
 * moves east — which is what keeps five offset courses from crossing.
 */
function northernProfile(pts: Ring, columns = 96): Ring {
  let min = Infinity;
  let max = -Infinity;
  for (const [lon] of pts) {
    min = Math.min(min, lon);
    max = Math.max(max, lon);
  }
  const span = max - min;
  const top: (number | null)[] = new Array(columns).fill(null);

  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    if (x1 === x2) continue;
    const lo = Math.min(x1, x2);
    const hi = Math.max(x1, x2);
    const from = Math.max(0, Math.ceil(((lo - min) / span) * (columns - 1)));
    const to = Math.min(columns - 1, Math.floor(((hi - min) / span) * (columns - 1)));
    for (let k = from; k <= to; k++) {
      const lon = min + (k / (columns - 1)) * span;
      const lat = y1 + ((lon - x1) / (x2 - x1)) * (y2 - y1);
      const best = top[k];
      if (best === null || lat > best) top[k] = lat;
    }
  }

  const out: Ring = [];
  top.forEach((lat, k) => {
    if (lat !== null) out.push([min + (k / (columns - 1)) * span, lat]);
  });
  return out;
}

/**
 * Label placement, set by hand.
 *
 * Pokhara and Langtang are on the same parallel to three decimal places, and
 * Langtang, Everest and Kathmandu fall inside one thumbprint on the page. No
 * rule of the "labels go right unless the marker is in the eastern third" kind
 * separates those; cartographers place labels by hand, and there are only
 * eight of them.
 */
const LABELS: Record<string, { dx: number; dy: number; anchor: "start" | "end" | "middle" }> = {
  mustang: { dx: 11, dy: 4, anchor: "start" },
  annapurna: { dx: 11, dy: 4, anchor: "start" },
  pokhara: { dx: -11, dy: 4, anchor: "end" },
  langtang: { dx: 0, dy: -14, anchor: "middle" },
  everest: { dx: -11, dy: -10, anchor: "end" },
  kathmandu: { dx: 11, dy: 17, anchor: "start" },
  chitwan: { dx: -11, dy: 15, anchor: "end" },
  lumbini: { dx: -11, dy: 4, anchor: "end" },
};

/** Equirectangular, x scaled by cos(mean latitude) so the shape is not
 *  stretched. At Nepal's size the distortion against a proper projection is
 *  smaller than the line weight. */
function makeProjection(pts: Ring) {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const [lon, lat] of pts) {
    minX = Math.min(minX, lon); maxX = Math.max(maxX, lon);
    minY = Math.min(minY, lat); maxY = Math.max(maxY, lat);
  }
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const w = (maxX - minX) * k;
  const h = maxY - minY;
  const scale = Math.min((W - PAD * 2) / w, (H - PAD * 2) / h);
  const ox = (W - w * scale) / 2;
  const oy = (H - h * scale) / 2;
  return ([lon, lat]: number[]): [number, number] => [
    ox + (lon - minX) * k * scale,
    oy + (maxY - lat) * scale,
  ];
}

export default function Atlas() {
  const project = useMemo(() => makeProjection(ring), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const [reached, setReached] = useState(0);
  // Nothing is scrubbed under reduced motion, so the whole route is shown at
  // once and the last chapter is the one standing.
  const active = useReducedMotion() ? mapChapters.length - 1 : reached;

  const border = useMemo(
    () => ring.map((p, i) => `${i ? "L" : "M"}${project(p).map((n) => n.toFixed(1)).join(" ")}`).join("") + "Z",
    [project],
  );

  const routeD = useMemo(() => {
    const pts = smoothPath(routeCoords as Coord[], 22);
    return pts.map((p, i) => `${i ? "L" : "M"}${project(p).map((n) => n.toFixed(1)).join(" ")}`).join("");
  }, [project]);

  // Himalayan relief, as hachure — the convention of a hand-drawn atlas rather
  // than a shaded raster.
  //
  // These used to be procedural ridgelines laid in a horizontal band across
  // the top of the frame. Nepal runs diagonally, so a horizontal band covers
  // the far west and nothing else, and the map read as a country with
  // mountains in one corner. Here each course is the country's own northern
  // skyline, stepped south — so the relief follows the arc of the range, the
  // whole way along it, which is where the range actually is.
  const ridges = useMemo(() => {
    const chain = northernProfile(ring);
    return Array.from({ length: 5 }, (_, i) => {
      const drop = 0.1 + i * 0.13;
      return chain
        .map((p, k) => {
          // Two frequencies of wobble, so the courses read as drawn hachure
          // rather than as five offsets of one curve.
          const wob = Math.sin(k * 1.7 + i * 2.3) * 0.032 + Math.sin(k * 0.6 + i) * 0.018;
          const [x, y] = project([p[0], p[1] - drop + wob]);
          return `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join("");
    });
  }, [project]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    registerGsap();

    const path = routeRef.current;
    const len = path?.getTotalLength() ?? 0;
    if (path) {
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = prefersReducedMotion() ? "0" : `${len}`;
    }

    if (prefersReducedMotion()) return;

    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        const n = mapChapters.length - 1;
        const routeProgress = Math.max(0, (p * n - 1) / (n - 1));
        if (path) path.style.strokeDashoffset = `${len * (1 - routeProgress)}`;
        const idx = Math.round(p * n);
        setReached((prev) => (prev === idx ? prev : idx));
      },
    });
    return () => st.kill();
  }, []);

  const chapter = mapChapters[active];

  return (
    <section
      ref={rootRef}
      aria-labelledby="atlas-title"
      className="relative"
      style={{ height: `${mapChapters.length * 80}vh` }}
    >
      <div className="on-ink paper-grain sticky top-0 flex h-screen w-full flex-col justify-center overflow-hidden">
        {/* The map gets its own box rather than the whole frame.
            On a phone it is cut to the plate's own proportions and the chapter
            sits directly under it, the pair centred — the map used to be
            centred in the whole screen with the chapter pinned to the foot,
            which left a third of the page empty above a very small country.
            From md up the box takes the width the chapter panel does not, so
            the eastern end — and the Everest label on it — stops disappearing
            underneath the panel. */}
        <div className="relative aspect-[1060/590] w-full shrink-0 md:absolute md:inset-y-0 md:left-0 md:right-[min(28rem,38vw)] md:aspect-auto md:w-auto">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
          focusable="false"
        >
          {/* Graticule — one degree of latitude and longitude */}
          <g stroke="#F7F4EC" strokeOpacity="0.07" strokeWidth="1">
            {[26, 27, 28, 29, 30].map((lat) => {
              const a = project([80, lat]);
              const b = project([89, lat]);
              return <line key={`la${lat}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
            })}
            {[81, 83, 85, 87].map((lon) => {
              const a = project([lon, 26]);
              const b = project([lon, 31]);
              return <line key={`lo${lon}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
            })}
          </g>

          {/* The country. Lifted well clear of the ink-deep ground behind it:
              at the old fill the silhouette was a shade off the background and
              the whole point of the plate — the shape of Nepal — was something
              you had to look for. */}
          <path d={border} fill="#0A3A55" stroke="#F7F4EC" strokeOpacity="0.5" strokeWidth="1.3" />

          {/* Himalayan hachure, clipped to the country */}
          <defs>
            <clipPath id="atlas-clip">
              <path d={border} />
            </clipPath>
          </defs>
          <g clipPath="url(#atlas-clip)">
            {ridges.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="#9DBBD4"
                strokeWidth="1"
                strokeOpacity={0.5 - i * 0.08}
              />
            ))}
          </g>

          {/* The route */}
          <path
            ref={routeRef}
            d={routeD}
            fill="none"
            stroke="#FDB614"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Destinations */}
          {mapChapters.map((c, i) => {
            if (!c.slug) return null;
            const [x, y] = project(c.center);
            const on = i <= active;
            const live = i === active;
            const place = LABELS[c.id] ?? { dx: 11, dy: 4, anchor: "start" as const };
            return (
              <g key={c.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
                <rect
                  x={-4}
                  y={-4}
                  width={8}
                  height={8}
                  transform="rotate(45)"
                  fill={live ? "#FDB614" : on ? "#F7F4EC" : "#0A3A55"}
                  stroke="#F7F4EC"
                  strokeWidth="1.2"
                  style={{ transition: "fill .5s ease" }}
                />
                {/*
                  The map is drawn to the width of a phone, so every label on
                  it is set at about half the size it is here. Eight of them at
                  that size is illegible clutter over the one thing worth
                  reading, which is the shape of the country — so below md only
                  the live chapter is named, and it is named large enough to
                  read. The panel underneath is already saying the name in
                  display type, which is what makes that affordable.
                */}
                <text
                  className={live ? undefined : "hidden md:block"}
                  x={place.dx}
                  y={place.dy + (live ? 2 : 0)}
                  textAnchor={place.anchor}
                  fontSize={live ? 18 : 12.5}
                  letterSpacing={live ? 1.8 : 1.4}
                  fill={live ? "#FDB614" : "#F7F4EC"}
                  fillOpacity={live ? 1 : 0.6}
                  style={{
                    fontFamily: "var(--font-sans)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    transition: "fill .5s ease, fill-opacity .5s ease",
                  }}
                >
                  {c.name}
                </text>
              </g>
            );
          })}
        </svg>
        </div>

        {/* Chapter */}
        <div className="relative z-10 p-[var(--spacing-gutter)] md:absolute md:inset-y-0 md:right-0 md:flex md:w-[min(28rem,38vw)] md:items-center">
          <div className="w-full bg-[color-mix(in_srgb,#00212F_90%,transparent)] p-6 md:p-8">
            <div className="flex items-baseline gap-3">
              <span className="numeral text-small text-gold">{pad2(active + 1)}</span>
              <span className="label text-[color-mix(in_srgb,#F7F4EC_58%,transparent)]">
                of {pad2(mapChapters.length)}
              </span>
              <span className="numeral ml-auto text-small tabular-nums text-gold">
                {chapter.kicker}
              </span>
            </div>
            <h2
              id="atlas-title"
              className="mt-4 font-[family-name:var(--font-display)] text-display-s leading-[1.05] text-paper"
            >
              {chapter.name}
            </h2>
            <p className="mt-3 text-body leading-relaxed text-[color-mix(in_srgb,#F7F4EC_78%,transparent)]">
              {chapter.note}
            </p>
            {chapter.slug && (
              <Link
                href={`/destinations/${chapter.slug}`}
                className="link-rule mt-5 inline-block text-paper"
              >
                <span className="label">Open {chapter.name}</span>
              </Link>
            )}
          </div>
        </div>

        <p className="absolute bottom-2 left-[var(--spacing-gutter)] text-micro text-[color-mix(in_srgb,#F7F4EC_34%,transparent)]">
          Boundary: Natural Earth. Positions are true coordinates.
        </p>
      </div>
    </section>
  );
}
