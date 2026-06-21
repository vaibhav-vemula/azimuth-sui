/** Station action. Usage: SUI_PRIVATE_KEY=<station> node station_unstake.mjs request|complete|cancel */
import { Transaction } from "@mysten/sui/transactions";
import { keypair, env, exec } from "./lib.mjs";
const PKG=env("PACKAGE_ID"), REG=env("REGISTRY_ID");
const a=process.argv[2];
const fn=a==="request"?"request_unstake":a==="complete"?"complete_unstake":"cancel_unstake";
const tx=new Transaction();
const args=[tx.object(REG)];
if(fn!=="cancel_unstake") args.push(tx.object("0x6"));
tx.moveCall({target:`${PKG}::orbital_vault::${fn}`, arguments:args});
await exec(tx, keypair(), fn);
