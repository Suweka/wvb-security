// Helpers for turning a human-readable name (e.g. "Deluxe Ocean View") into a
// URL-friendly "slug" (e.g. "deluxe-ocean-view") used in room page URLs.

// Converts any string into a lowercase, hyphen-separated slug.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    // Replace any run of one-or-more characters that are NOT a-z or 0-9 with a
    // single hyphen (collapses spaces/punctuation/etc. into "-").
    .replace(/[^a-z0-9]+/g, '-')
    // Trim a leading or trailing hyphen left over from the previous step.
    .replace(/(^-|-$)/g, '');
}

// Generates a slug that's guaranteed not to collide with an existing one, by
// appending "-2", "-3", etc. until `slugExists` reports the candidate is free.
// `slugExists` is passed in by the caller (usually a Prisma lookup) so this
// function doesn't need to know about the database directly.
export async function uniqueSlug(
  name: string,
  slugExists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = slugify(name) || 'room'; // fallback name if slugify() produces an empty string
  let candidate = base;
  let suffix = 2;
  while (await slugExists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix++;
  }
  return candidate;
}
