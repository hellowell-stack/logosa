import Image from "next/image";
import type { Photo } from "@/data/photos";
import { cn } from "@/lib/utils";

/**
 * A photograph from the library, covering the frame it is set in.
 *
 * Every plate on the site is a cropped frame — a fixed aspect or a fixed
 * height, with the picture filling it — so the frame decides the shape and
 * the photograph only decides what is seen through it. The frame has to be
 * positioned; `.figure-frame` already is.
 *
 * `sizes` is required because only the call site knows how wide its frame is
 * at each breakpoint. Left out, every phone downloads the desktop image.
 */
export default function Photograph({
  photo,
  sizes,
  alt = photo.alt,
  preload = false,
  className,
}: {
  photo: Photo;
  sizes: string;
  /** Pass "" where the photograph only repeats the link it sits in. */
  alt?: string;
  /** Only for the largest image in the first screen of a page. */
  preload?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={photo.src}
      alt={alt}
      fill
      sizes={sizes}
      quality={82}
      preload={preload}
      className={cn("object-cover", className)}
      style={photo.focus ? { objectPosition: photo.focus } : undefined}
    />
  );
}
