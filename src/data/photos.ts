/**
 * PHOTOGRAPHS
 *
 * Every photograph on the site, described once. Destinations, journeys and
 * stories point at an entry here rather than carrying their own path and alt
 * text, so a picture used on three pages is described the same way on all
 * three — by what is actually in the frame — and cannot be relabelled on one
 * page and left wrong on another.
 *
 * `source` is the original as supplied, under /images at the project root.
 * `src` is the web copy, written from it by `npm run build:images`. Never edit
 * the web copies by hand: replace the original and re-run the script.
 */

export interface Photo {
  /** Served path under /public. Generated from `source`. */
  src: string;
  /** The original, exactly as supplied, relative to the project root. */
  source: string;
  /** What is in the frame. Not what the page it sits on is about. */
  alt: string;
  /**
   * Where to hold the crop, as a CSS object-position. Only set where the
   * subject sits far enough off-centre that a tall or narrow frame would cut
   * it out.
   */
  focus?: string;
}

export const photos = {
  swayambhunath: {
    src: "/images/photos/swayambhunath.webp",
    source: "images/kathmandu valley/kathmandu.png",
    alt: "The painted eyes and gilded spire of Swayambhunath stupa beneath strings of prayer flags, pigeons on the dome and a gilded temple roof beside it",
  },
  nyatapola: {
    src: "/images/photos/bhaktapur-nyatapola.webp",
    source: "images/kathmandu valley/bhaktapur.png",
    alt: "The five-tiered Nyatapola temple and the Bhairavnath temple above a crowded Taumadhi Square in Bhaktapur, the hills of the valley rim behind",
    focus: "30% 50%",
  },
  patanDurbarSquare: {
    src: "/images/photos/patan-durbar-square.webp",
    source: "images/kathmandu valley/lalitpur.png",
    alt: "The stone shikhara of Krishna Mandir beside a tiered pagoda in Patan Durbar Square, under heavy cloud",
    focus: "65% 50%",
  },
  phewaLake: {
    src: "/images/photos/phewa-lake.webp",
    source: "images/pokhara/pokhara 1.png",
    alt: "Painted wooden boats moored on Phewa Lake at Pokhara, forested hills rising behind",
  },
  dhaulagiri: {
    src: "/images/photos/dhaulagiri-rhododendron.webp",
    source: "images/pokhara/pokhara 2.png",
    alt: "Dhaulagiri seen from the Poon Hill ridge, rhododendron trees in full red flower in the foreground",
  },
  everestAerial: {
    src: "/images/photos/everest-aerial.webp",
    source: "images/Everest-and-khumbu/khumbu.png",
    alt: "Everest from the air, its summit pyramid standing above the surrounding ridges, cloud filling the valleys below",
  },
  khumbuIcefall: {
    src: "/images/photos/khumbu-icefall.webp",
    source: "images/Everest-and-khumbu/everest.png",
    alt: "Everest above the Khumbu Icefall, Nuptse to the right and the tents of Base Camp scattered along the glacier below",
  },
  annapurnaSanctuary: {
    src: "/images/photos/annapurna-sanctuary.webp",
    source: "images/Annapurna/annapurna.png",
    alt: "A line of trekkers on the snow trail to Annapurna Base Camp, the snow faces of the sanctuary rising ahead",
  },
  mustangChortens: {
    src: "/images/photos/mustang-chortens.webp",
    source: "images/Upper Mustang/uppermustang.png",
    alt: "Red-capped chortens and a whitewashed gompa beneath fluted, eroded cliffs in Upper Mustang, snow peaks behind",
    focus: "60% 50%",
  },
  langtangBridge: {
    src: "/images/photos/langtang-bridge.webp",
    source: "images/Langtang/langtang.png",
    alt: "A trekker crossing a prayer-flagged suspension bridge in the Langtang valley, snow peaks at its head",
  },
  chitwanRiver: {
    src: "/images/photos/chitwan-river.webp",
    source: "images/Chitwan/chitwan.png",
    alt: "An elephant and its rider wading a misty river channel through the Chitwan grassland, a thatched watchtower on the bank",
    focus: "62% 50%",
  },
  mayaDevi: {
    src: "/images/photos/lumbini-maya-devi.webp",
    source: "images/Lumbini/lumbini.png",
    alt: "The Maya Devi Temple and the Ashokan pillar at Lumbini, reflected in the sacred pond beneath a golden sky",
  },
} satisfies Record<string, Photo>;
