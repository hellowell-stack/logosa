import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The local development database: it downloads and spawns a real mongod,
  // which only works from its own package directory, not from a bundle. (The
  // `mongodb` driver itself is on Next's built-in external list.)
  serverExternalPackages: ["mongodb-memory-server-core"],

  images: {
    // Every plate is a photograph (src/data/photos.ts), served from one WebP
    // per picture that `npm run build:images` writes. The optimiser cuts the
    // smaller sizes and the AVIF copies from it on demand.
    //
    // Next 16 requires an explicit allowlist; anything outside it is coerced
    // to the nearest permitted value.
    qualities: [70, 82, 92],
    formats: ["image/avif", "image/webp"],
    localPatterns: [{ pathname: "/images/**" }, { pathname: "/brand/**" }],
  },

  // Large binary assets are content-hashed by name and never change in place,
  // so they can be cached hard. GLB is not in Next's default asset pipeline.
  async headers() {
    return [
      {
        source: "/models/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/textures/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
