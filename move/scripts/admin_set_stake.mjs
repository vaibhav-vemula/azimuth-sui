/** Owner-only: set the registry's required stake amount. Usage: node admin_set_stake.mjs <amount> */
import { Transaction } from "@mysten/sui/transactions";
import { keypair, env, exec } from "./lib.mjs";

const PKG = env("PACKAGE_ID");
const REG = env("REGISTRY_ID");
const ADMIN = env("ADMIN_CAP_ID");
const amount = BigInt(process.argv[2] || "10");

const tx = new Transaction();
tx.moveCall({
  target: `${PKG}::orbital_vault::set_stake_amount`,
  arguments: [tx.object(REG), tx.pure.u64(amount), tx.object(ADMIN)],
});
await exec(tx, keypair(), `set_stake_amount(${amount})`);
