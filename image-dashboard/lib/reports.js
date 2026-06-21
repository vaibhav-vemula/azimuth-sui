/** Fetch the Analyst Agent's report index (served by /api/reports). */
export async function fetchReports() {
  try {
    const res = await fetch("/api/reports");
    if (!res.ok) return [];
    const { reports } = await res.json();
    return Array.isArray(reports) ? reports : [];
  } catch {
    return [];
  }
}

/**
 * Index reports for per-image lookup. Keyed by BOTH the analyzed image blob id and
 * the passId, so an image matches whether or not the analyst captured its blob id.
 */
export function reportsByImage(reports) {
  const map = {};
  for (const r of reports) {
    if (r.imageBlobId && !map[r.imageBlobId]) map[r.imageBlobId] = r;
    if (r.passId && !map[r.passId]) map[r.passId] = r;
  }
  return map;
}

/** Find the report for an image by blob id, then passId. */
export function reportForImage(map, img) {
  if (!map || !img) return null;
  return map[img.blobId] || map[img.passId] || null;
}
