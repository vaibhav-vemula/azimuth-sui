"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAllStations } from "../../lib/sui";
import { resolveInput, getAzimuthRecords } from "../../lib/suins";
import { isStationOnline, formatAzm, truncateAddress } from "../../lib/utils";

const TIER_COLORS = {
  Gold:     "text-amber-400 bg-amber-400/10 border-amber-400/25",
  Silver:   "text-slate-300 bg-slate-300/10 border-slate-300/25",
  Bronze:   "text-orange-400 bg-orange-400/10 border-orange-400/25",
};

function StationCard({ station, ensName, records }) {
  const online = isStationOnline(station.lastHeartbeat, 300);
  const tierColor = TIER_COLORS[records?.tier] || "text-cyan-400 bg-cyan-400/10 border-cyan-400/25";
  const stationParam = ensName || station.address;

  return (
    <Link
      href={`/?station=${stationParam}`}
      className={`
        block bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/[0.06]
        border-t-2 rounded-xl p-5 transition-all duration-200 hover:shadow-lg
        hover:border-cyan-500/30 hover:shadow-cyan-500/10 group
        ${online ? "border-t-emerald-500" : "border-t-slate-600"}
      `}
    >
      {/* Top row: online dot + ENS name + tier */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0 mt-0.5">
            {online && <span className="ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-400" : "bg-slate-500"}`} />
          </span>
          <span className={`text-sm font-bold truncate ${online ? "text-emerald-400" : "text-slate-500"}`}>
            {online ? "Online" : "Offline"}
          </span>
        </div>
        {records?.tier && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${tierColor}`}>
            {records.tier}
          </span>
        )}
      </div>

      {/* ENS name or address */}
      <div className="mb-1">
        {ensName ? (
          <div className="flex items-center gap-1.5">
            <p className="text-base font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors truncate">
              {ensName}
            </p>
            <span className="text-[10px] font-bold text-indigo-400/50 shrink-0">SuiNS</span>
          </div>
        ) : (
          <p className="text-sm font-mono text-slate-600 dark:text-slate-400 truncate">
            {truncateAddress(station.address)}
          </p>
        )}
      </div>

      {/* ENS metadata grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-4">
        {(records?.location || station.location) && (
          <div className="col-span-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Location</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{records?.location || station.location}</p>
          </div>
        )}
        {records?.hardware && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Hardware</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{records.hardware}</p>
          </div>
        )}
        {records?.antennaGain && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Antenna</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{records.antennaGain}</p>
          </div>
        )}
        {records?.elevation && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Elevation</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{records.elevation}</p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.04]">
        {[
          { label: "PoA", value: `${formatAzm(station.totalPoaRewards)} AZM` },
          { label: "PoRx", value: `${formatAzm(station.totalPorxRewards)} AZM` },
          { label: "HBs", value: station.heartbeatCount?.toLocaleString() ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 truncate">{value}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/[0.06] border-t-2 border-t-slate-300 dark:border-t-slate-700 rounded-xl p-5 space-y-3">
      <div className="skeleton h-2.5 w-16" />
      <div className="skeleton h-4 w-32" />
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-8 w-full rounded-lg" />
      <div className="grid grid-cols-3 gap-2 pt-3">
        <div className="skeleton h-8 rounded" />
        <div className="skeleton h-8 rounded" />
        <div className="skeleton h-8 rounded" />
      </div>
    </div>
  );
}

export default function StationsPage() {
  const [stations, setStations]   = useState([]);
  const [ensData, setEnsData]     = useState({});
  const [loading, setLoading]     = useState(true);
  const [ensLoading, setEnsLoading] = useState(false);

  useEffect(() => {
    getAllStations()
      .then(async (list) => {
        setStations(list);
        setLoading(false);
        if (list.length === 0) return;

        // Resolve ENS for all stations in parallel
        setEnsLoading(true);
        const results = {};
        await Promise.all(list.map(async (s) => {
          const { ensName } = await resolveInput(s.address);
          const records = ensName ? await getAzimuthRecords(ensName) : null;
          results[s.address] = { ensName, records };
        }));
        setEnsData(results);
        setEnsLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const ensVerified = Object.values(ensData).filter((d) => d.ensName).length;
  const online = stations.filter((s) => isStationOnline(s.lastHeartbeat, 300)).length;

  return (
    <div className="min-h-screen">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-white/[0.06] bg-white/95 dark:bg-[#030712]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-5">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-cyan-500/20">
              <Image src="/azimuth_logo.png" alt="Azimuth" width={40} height={40} className="object-contain" />
            </div>
            <div className="hidden sm:block">
              <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none">Azimuth</div>
              <div className="text-xs text-slate-500 uppercase tracking-widest mt-0.5">Node Dashboard</div>
            </div>
          </Link>

          <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-white/[0.08]" />

          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="h-8 px-3 flex items-center text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg transition-all"
            >
              Dashboard
            </Link>
            <span className="h-8 px-3 flex items-center text-sm font-semibold text-cyan-500 bg-cyan-500/[0.08] border border-cyan-500/20 rounded-lg">
              All Stations
            </span>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="h-8 flex items-center gap-2 text-xs px-3 rounded-lg bg-amber-500/[0.08] text-amber-500 dark:text-amber-400 border border-amber-500/20 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Sui Testnet
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">

        {/* Page heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-1">
            Ground Station Network
          </h1>
          {!loading && (
            <p className="text-slate-500 text-sm">
              {stations.length} station{stations.length !== 1 ? "s" : ""} registered on Sui
              {ensVerified > 0 && ` · ${ensVerified} SuiNS-verified`}
              {` · ${online} online`}
              {ensLoading && " · resolving SuiNS…"}
            </p>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : stations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">No stations registered</p>
            <p className="text-slate-500 text-sm">Run <code className="font-mono bg-slate-100 dark:bg-white/[0.04] px-1.5 py-0.5 rounded">registerStations.js</code> to add stations.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {stations.map((s) => (
              <StationCard
                key={s.address}
                station={s}
                ensName={ensData[s.address]?.ensName ?? null}
                records={ensData[s.address]?.records ?? null}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
