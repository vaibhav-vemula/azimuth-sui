"use client";

/**
 * AgentIntelligence — surfaces the Analyst Agent's reports + their Walrus memory links.
 *
 * This is the visible proof of the Walrus-track thesis: an autonomous agent turning
 * imagery into a verifiable, durable intelligence record stored on Walrus.
 */

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function qualityColor(q) {
  if (q >= 8) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";
  if (q >= 5) return "text-amber-400 bg-amber-500/10 border-amber-500/25";
  return "text-red-400 bg-red-500/10 border-red-500/25";
}

export default function AgentIntelligence({ reports }) {
  if (!reports || reports.length === 0) return null;

  return (
    <div className="mb-10 rounded-2xl border border-violet-400/15 bg-white dark:bg-[#0d1117] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🤖</span>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Agent Intelligence
          </h3>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-300 bg-violet-500/10 border border-violet-500/25 rounded-full px-2 py-0.5">
            memory on Walrus
          </span>
        </div>
        <span className="text-sm font-mono text-slate-500 bg-slate-50 dark:bg-white/[0.03] px-3 py-1 rounded-lg border border-slate-200 dark:border-white/[0.06]">
          {reports.length} report{reports.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-white/[0.04] max-h-96 overflow-y-auto">
        {reports.slice(0, 12).map((r, i) => (
          <div key={(r.reportBlobId || i) + ""} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-violet-400 truncate">{r.satellite || "unknown"}</span>
                {r.highValue && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5">
                    high-value
                  </span>
                )}
                {typeof r.cloudCoverPct === "number" && (
                  <span className="shrink-0 text-xs text-slate-500">☁ {r.cloudCoverPct}%</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {typeof r.qualityScore === "number" && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${qualityColor(r.qualityScore)}`}>
                    Q {r.qualityScore}/10
                  </span>
                )}
                <span className="text-xs text-slate-400 dark:text-slate-600">{timeAgo(r.createdAt)}</span>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{r.summary}</p>

            {Array.isArray(r.anomalies) && r.anomalies.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.anomalies.map((a, j) => (
                  <span key={j} className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">⚠ {a}</span>
                ))}
              </div>
            )}

            {r.reportUrl && (
              <a
                href={r.reportUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-500 hover:text-cyan-400 hover:underline font-mono"
              >
                verifiable memory on Walrus ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
