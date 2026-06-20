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

/** Index reports by the image blob they analyzed, for per-image attachment. */
export function reportsByImage(reports) {
  const map = {};
  for (const r of reports) {
    if (r.imageBlobId && !map[r.imageBlobId]) map[r.imageBlobId] = r;
  }
  return map;
}
