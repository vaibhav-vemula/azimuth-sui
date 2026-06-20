/**
 * llm.js — Claude models via the Vercel AI SDK.
 *
 * `hasLLM` lets every agent degrade gracefully to a deterministic heuristic when no
 * ANTHROPIC_API_KEY is set, so the whole system is runnable without credentials.
 */

import "./env.js";
import { anthropic } from "@ai-sdk/anthropic";

export const hasLLM = !!process.env.ANTHROPIC_API_KEY;

export function reasoningModel() {
  // Sonnet 4.6 is the reliable default with the pinned AI SDK v4. (Opus 4.8 rejects the
  // `temperature` param this SDK version sends; use it only with a newer @ai-sdk core.)
  return anthropic(process.env.AZIMUTH_MODEL_REASON || "claude-sonnet-4-6");
}

export function fastModel() {
  return anthropic(process.env.AZIMUTH_MODEL_FAST || "claude-sonnet-4-6");
}
