export const CATEGORIES = ['All', 'Politics', 'Tech', 'Economy', 'Culture'] as const;
export type Category = (typeof CATEGORIES)[number];

/** Normalize a category label from the DB to one of our known filters (case-insensitive). */
export function normalizeCategory(raw: string): string {
  const lower = raw.trim().toLowerCase();
  const known = CATEGORIES.filter((c) => c !== 'All').map((c) => c.toLowerCase());
  if (known.includes(lower)) {
    return CATEGORIES.find((c) => c.toLowerCase() === lower) as string;
  }
  return raw.trim();
}

export function categoryColor(category: string): {
  bg: string;
  text: string;
  border: string;
  hover: string;
} {
  const c = category.toLowerCase();
  const map: Record<string, { bg: string; text: string; border: string; hover: string }> = {
    politics: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', hover: 'hover:bg-red-700' },
    tech: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', hover: 'hover:bg-blue-700' },
    economy: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', hover: 'hover:bg-emerald-700' },
    culture: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', hover: 'hover:bg-amber-700' },
  };
  return (
    map[c] ?? {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      border: 'border-gray-300',
      hover: 'hover:bg-gray-700',
    }
  );
}
