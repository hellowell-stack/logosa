import { journeyBySlug } from "@/data/journeys";
import { destinationBySlug } from "@/data/destinations";

/** What an enquiry was about, in a few words: the journey, or the places. */
export function enquirySubject(e: { journeySlug: string | null; destinationSlugs: string[] | null }): string {
  const journey = e.journeySlug ? journeyBySlug(e.journeySlug)?.name : undefined;
  if (journey) return journey;
  const places = (e.destinationSlugs ?? []).map((s) => destinationBySlug(s)?.name).filter(Boolean);
  return places.length ? places.join(", ") : "General";
}
