/** Owner-only: set PoA epoch interval (ms). Usage: node admin_set_interval.mjs <ms> */
import { Transaction } from "@mysten/sui/transactions";
import { keypair, env, exec } from "./lib.mjs";
const PKG = env("PACKAGE_ID"), REG = env("REGISTRY_ID"), ADMIN = env("ADMIN_CAP_ID");
const ms = BigInt(process.argv[2] || "300000");
const tx = new Transaction();
tx.moveCall({ target: `${PKG}::orbital_vault::set_epoch_interval`, arguments: [tx.object(REG), tx.pure.u64(ms), tx.object(ADMIN)] });
await exec(tx, keypair(), `set_epoch_interval(${ms} ms)`);
