/**
 * Analyst Agent — the artifact-driven workflow agent.
 *
 * Trigger: a new merged satellite image on Walrus (from the existing ImageMerged Sui event).
 * It runs vision analysis, RECALLs prior reports for temporal comparison, writes a structured
 * report back to Walrus as a reusable artifact, and indexes it in memory. Next time, those
 * reports become memory the agent builds on — "generate, store, and reuse files."
 */

import { z } from "zod";
import { generateObject } from "ai";
import { hasLLM, reasoningModel } from "../shared/llm.js";
import { uploadArtifact } from "../shared/walrus.js";

const ReportSchema = z.object({
  cloudCoverPct: z.number().min(0).max(100),
  features: z.array(z.string()),
  anomalies: z.array(z.string()),
  qualityScore: z.number().min(0).max(10),
  highValue: z.boolean(),
  summary: z.string(),
});

async function priorReports(memory, satellite) {
  const hits = await memory.recall(`analysis report ${satellite} cloud anomaly`, 3);
  return hits.map((h) => h.text);
}

export async function analyzeImage({ imageBytes, pass, memory }) {
  const satellite = pass?.satellite || "unknown";
  const priors = await priorReports(memory, satellite);

  if (hasLLM) {
    const prompt = [
      `You are a satellite-imagery analyst. Analyze this ${satellite} capture.`,
      `Report cloud cover %, notable features, any anomalies (storm, wildfire smoke, ice, sensor glitches),`,
      `a quality score 0-10, and whether it is high-value enough to retain long-term.`,
      priors.length ? `\nPrior reports for ${satellite} (for temporal comparison):\n- ${priors.join("\n- ")}` : `\n(no prior reports yet)`,
      `\nIn the summary, explicitly note any change vs. the prior reports.`,
    ].join("\n");

    try {
      const { object } = await generateObject({
        model: reasoningModel(),
        schema: ReportSchema,
        messages: [
          { role: "user", content: [{ type: "text", text: prompt }, { type: "image", image: imageBytes }] },
        ],
      });
      return { report: object, priors, usedLLM: true };
    } catch (err) {
      console.warn(`[analyst] vision analysis failed (${err.message}) → heuristic`);
    }
  }

  // Heuristic fallback: derive coarse stats from the bytes (brightness proxy), no LLM.
  const n = imageBytes.length;
  let sum = 0;
  const step = Math.max(1, Math.floor(n / 4096));
  for (let i = 0; i < n; i += step) sum += imageBytes[i];
  const brightness = sum / Math.ceil(n / step) / 255; // 0..1
  const cloudCoverPct = Math.round(brightness * 100);
  const qualityScore = Math.round((1 - Math.abs(0.5 - brightness) * 2) * 10 * 10) / 10;
  const report = {
    cloudCoverPct,
    features: brightness > 0.6 ? ["high reflectance / likely cloud"] : ["surface detail visible"],
    anomalies: [],
    qualityScore,
    highValue: qualityScore >= 7,
    summary:
      `${satellite}: ~${cloudCoverPct}% cloud cover (brightness proxy), quality ${qualityScore}/10.` +
      (priors.length ? ` Prior reports on file: ${priors.length}.` : " First report for this satellite."),
  };
  return { report, priors, usedLLM: false };
}

/** Store the report as a reusable Walrus artifact and index it in memory. */
export async function storeReport({ memory, report, pass, imageBlobId }) {
  const artifact = {
    type: "azimuth-analysis-report",
    satellite: pass?.satellite,
    passId: pass?.id,
    imageBlobId,
    report,
    createdAt: new Date().toISOString(),
  };
  let stored = { blobId: null, url: null };
  try {
    stored = await uploadArtifact(artifact);
  } catch (err) {
    console.warn(`[analyst] report upload failed (${err.message}) — indexing locally only`);
  }
  await memory.remember(
    `Analysis report for ${pass?.satellite} (pass ${pass?.id}): ${report.summary} ` +
      `[cloud ${report.cloudCoverPct}%, quality ${report.qualityScore}/10, ` +
      `highValue ${report.highValue}]${stored.blobId ? ` artifact=${stored.blobId}` : ""}`,
    { type: "analysis-report", satellite: pass?.satellite, passId: pass?.id, reportBlobId: stored.blobId, imageBlobId, ...report }
  );
  return stored;
}
