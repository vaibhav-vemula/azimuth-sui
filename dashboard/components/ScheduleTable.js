import { timeAgo } from "../lib/utils";

const TYPE_CONFIG = {
  "PoA Settlement": { icon: "⚡", color: "text-cyan-400" },
  "PoRx Payout": { icon: "📡", color: "text-emerald-400" },
  "Image Recorded": { icon: "🛰️", color: "text-violet-400" },
};

const SUIVISION = "https://testnet.suivision.xyz/txblock";

export default function ScheduleTable({ schedules }) {
  return (
    <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.05]">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          On-chain Activity
        </h3>
        {schedules?.length > 0 && (
          <span className="text-sm font-mono text-slate-500 bg-slate-50 dark:bg-white/[0.03] px-3 py-1 rounded-lg border border-slate-200 dark:border-white/[0.06]">
            {schedules.length} event{schedules.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {!schedules || schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-3xl mb-3">📋</span>
          <p className="text-slate-500 text-sm">No activity yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white dark:bg-[#0d1117] z-10">
              <tr className="text-left border-b border-slate-200 dark:border-white/[0.05]">
                {["Type", "Transaction", "Time", "Status"].map((h) => (
                  <th key={h} className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-600 uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map((s, i) => {
                const conf = TYPE_CONFIG[s.type] || { icon: "•", color: "text-slate-400" };
                const digest = s.digest || s.address;
                return (
                  <tr key={digest || i} className="border-t border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{conf.icon}</span>
                        <span className={`text-sm font-semibold ${conf.color}`}>{s.type}</span>
                        {s.epoch != null && <span className="text-xs text-slate-400 dark:text-slate-600 font-mono">#{s.epoch}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-sm whitespace-nowrap">
                      {digest ? (
                        <a href={`${SUIVISION}/${digest}`} target="_blank" rel="noreferrer" className="text-cyan-500 hover:text-cyan-400 hover:underline transition-colors">
                          {digest.slice(0, 10)}…
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500 whitespace-nowrap">{s.timestamp ? timeAgo(s.timestamp) : "—"}</td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-semibold px-3 py-1.5 rounded-full border text-emerald-400 bg-emerald-400/10 border-emerald-500/25">
                        Executed
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
