/**
 * What an admin server action hands back to its form: an error to show, or a
 * short notice confirming what happened. Kept out of the "use server" files,
 * which may only export async functions.
 */
export type FormResult = { error?: string; notice?: string } | undefined;

/** A document id (UUID). Checked before querying, so a mangled URL is a clean 404. */
export const isUuid = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
