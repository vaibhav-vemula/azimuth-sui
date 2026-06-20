/**
 * /api/reports — serves the Analyst Agent's report index.
 *
 * The Analyst writes agents/.memory/reports-index.json (each entry links a Walrus
 * report blob to the merged image it analyzed). This route exposes it to the gallery.
 * Override the path with AZIMUTH_REPORTS_INDEX if the agents run elsewhere.
 */

import fs from "node:fs";
import path from "node:path";

const INDEX_PATH =
  process.env.AZIMUTH_REPORTS_INDEX ||
  path.resolve(process.cwd(), "../agents/.memory/reports-index.json");

export async function GET() {
  try {
    const raw = fs.readFileSync(INDEX_PATH, "utf-8");
    const reports = JSON.parse(raw);
    return Response.json({ reports: Array.isArray(reports) ? reports : [] });
  } catch {
    // No reports yet (agents not run / different machine) — return empty, not an error.
    return Response.json({ reports: [] });
  }
}
