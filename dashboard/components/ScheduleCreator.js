"use client";

import { useState } from "react";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

const PKG = process.env.NEXT_PUBLIC_PACKAGE_ID;
const REG = process.env.NEXT_PUBLIC_REGISTRY_ID;
const SUIVISION = "https://testnet.suivision.xyz/txblock";

export default function ScheduleCreator() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [status, setStatus] = useState(null); // null | "loading" | "success" | "error"
  const [result, setResult] = useState(null);

  function call(fn, label) {
    setStatus("loading");
    setResult(null);
    const tx = new Transaction();
    const args = [tx.object(REG)];
    if (fn !== "cancel_unstake") args.push(tx.object("0x6")); // Clock
    tx.moveCall({ target: `${PKG}::orbital_vault::${fn}`, arguments: args });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (res) => { setStatus("success"); setResult({ digest: res.digest, label }); },
        onError: (err) => { setStatus("error"); setResult({ error: err.message }); },
      }
    );
  }

  return (
    <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/[0.06] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Station Actions</h3>
        <ConnectButton />
      </div>

      {!account ? (
        <p className="text-sm text-slate-500">Connect a Sui wallet to manage your stake (unstake has a 7-day cooldown).</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => call("request_unstake", "Unstake requested")}
            disabled={status === "loading"}
            className="h-10 px-5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 whitespace-nowrap"
          >
            {status === "loading" ? "Submitting…" : "Request Unstake"}
          </button>
          <button
            onClick={() => call("complete_unstake", "Unstaked")}
            disabled={status === "loading"}
            className="h-10 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.10] disabled:opacity-50 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-all whitespace-nowrap"
          >
            Complete Unstake
          </button>
          <button
            onClick={() => call("cancel_unstake", "Unstake cancelled")}
            disabled={status === "loading"}
            className="h-10 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.10] disabled:opacity-50 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-all whitespace-nowrap"
          >
            Cancel Unstake
          </button>
        </div>
      )}

      {status === "success" && result && (
        <div className="mt-4 p-4 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl">
          <p className="text-xs font-semibold text-emerald-400 mb-2">{result.label} ✓</p>
          <a href={`${SUIVISION}/${result.digest}`} target="_blank" rel="noreferrer" className="text-xs text-cyan-500 hover:text-cyan-400 hover:underline transition-colors">
            View transaction on SuiVision →
          </a>
        </div>
      )}
      {status === "error" && result && (
        <div className="mt-4 p-4 bg-red-500/[0.06] border border-red-500/20 rounded-xl">
          <p className="text-xs font-semibold text-red-400 mb-1">Action failed</p>
          <p className="text-xs text-slate-500 break-all">{result.error}</p>
        </div>
      )}
    </div>
  );
}
