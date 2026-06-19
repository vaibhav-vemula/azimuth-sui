"use client";

import { useState } from "react";

/* ── Icons (inline, stroke-based to match the dashboard) ─────────────────────── */
const I = {
  location: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  hardware: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
    </svg>
  ),
  antenna: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 12v9" /><path d="m8 21 4-9 4 9" /><path d="M5.6 9a6 6 0 0 1 0-6M18.4 3a6 6 0 0 1 0 6M8.5 7.5a2.5 2.5 0 0 1 0-3M15.5 4.5a2.5 2.5 0 0 1 0 3" />
    </svg>
  ),
  elevation: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m3 17 5-7 4 5 3-4 6 6" /><path d="M3 21h18" />
    </svg>
  ),
  copy: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  external: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  ),
};

/* deterministic hue pair from the name so each station gets a stable identicon */
function hues(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return [h, (h + 48) % 360];
}

const truncate = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function EnsIdentity({ ensName, ensRecords, ensAvatar, address }) {
  const [copied, setCopied] = useState(false);
  if (!ensName) return null;

  const [h1, h2] = hues(ensName);
  const [label] = ensName.split(".sui");

  const meta = [
    ensRecords?.location    && { icon: I.location,  label: "Location", value: ensRecords.location },
    ensRecords?.hardware    && { icon: I.hardware,  label: "Hardware", value: ensRecords.hardware },
    ensRecords?.antennaGain && { icon: I.antenna,   label: "Antenna",  value: ensRecords.antennaGain },
    ensRecords?.elevation   && { icon: I.elevation, label: "Elevation",value: ensRecords.elevation },
  ].filter(Boolean);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-indigo-400/15 bg-[#0c0f1d]/80 card-hover-violet fade-up">
      {/* drifting conic sheen */}
      <div className="pointer-events-none absolute -inset-px opacity-60">
        <div className="ens-sheen absolute left-1/2 top-0 h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/3" />
      </div>
      {/* inner glass layer */}
      <div className="relative m-px rounded-2xl bg-gradient-to-br from-indigo-500/[0.09] via-violet-500/[0.04] to-transparent p-4 backdrop-blur-xl">

        {/* header */}
        <div className="flex items-center gap-3">
          {/* avatar */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl blur-md opacity-60"
                 style={{ background: `linear-gradient(135deg, hsl(${h1} 85% 60%), hsl(${h2} 85% 55%))` }} />
            {ensAvatar ? (
              <img src={ensAvatar} alt={ensName}
                   className="relative h-11 w-11 rounded-xl object-cover ring-1 ring-white/20" />
            ) : (
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold text-white ring-1 ring-white/20"
                   style={{ background: `linear-gradient(135deg, hsl(${h1} 80% 55%), hsl(${h2} 80% 48%))` }}>
                {label.slice(0, 2).toUpperCase()}
              </div>
            )}
            {/* verified tick */}
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-[#0c0f1d]">
              <I.check className="h-3 w-3" />
            </span>
          </div>

          {/* name + badges */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono-ens ens-name-glow truncate text-lg font-bold tracking-tight">
                {ensName}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/25">
                <I.check className="h-2.5 w-2.5" /> Verified
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300 ring-1 ring-indigo-500/25">
                SuiNS
              </span>
            </div>
          </div>

          {/* ENS app link */}
          <a href={`https://suins.io/name/${ensName}`} target="_blank" rel="noreferrer"
             title="View on SuiNS app"
             className="shrink-0 rounded-lg p-2 text-indigo-300/70 transition-colors hover:bg-white/[0.06] hover:text-indigo-200">
            <I.external className="h-4 w-4" />
          </a>
        </div>

        {/* metadata grid */}
        {meta.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {meta.map(({ icon: Ic, label: l, value }) => (
              <div key={l} className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-300">
                  <Ic className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{l}</p>
                  <p className="truncate text-xs font-medium text-slate-200">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* footer: resolved address */}
        {address && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Resolves to</span>
            <button onClick={copy}
                    className="group flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-white/[0.05]">
              <span className="font-mono-ens text-slate-300">{truncate(address)}</span>
              {copied ? (
                <span className="ens-copy-flash flex items-center gap-0.5 text-emerald-400"><I.check className="h-3 w-3" /></span>
              ) : (
                <I.copy className="h-3 w-3 text-slate-500 transition-colors group-hover:text-slate-300" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
