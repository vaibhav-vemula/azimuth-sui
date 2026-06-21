/** Owner: send SUI to an address. Usage: node admin_send_sui.mjs <to> <mist> */
import { Transaction } from "@mysten/sui/transactions";
import { keypair, env, exec } from "./lib.mjs";
const to = process.argv[2];
const amount = BigInt(process.argv[3] || "200000000");
const tx = new Transaction();
const [c] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
tx.transferObjects([c], tx.pure.address(to));
await exec(tx, keypair(), `send ${amount} MIST → ${to}`);
