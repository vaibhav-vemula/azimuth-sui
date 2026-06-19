/** Shared helpers for the deploy/init scripts. */
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

export const NETWORK = process.env.SUI_NETWORK || "testnet";
export const suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });

export function keypair() {
  const sk = process.env.SUI_PRIVATE_KEY;
  if (!sk || sk.includes("suiprivkey1...")) throw new Error("Set SUI_PRIVATE_KEY in move/scripts/.env");
  return Ed25519Keypair.fromSecretKey(sk);
}

export function env(name, fallback) {
  const v = process.env[name];
  if ((!v || v.startsWith("0x...")) && fallback === undefined) {
    throw new Error(`Set ${name} in move/scripts/.env`);
  }
  return v ?? fallback;
}

export async function exec(tx, signer, label = "tx") {
  const res = await suiClient.signAndExecuteTransaction({
    signer,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });
  await suiClient.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== "success") {
    throw new Error(`${label} failed: ${res.effects?.status?.error}`);
  }
  console.log(`✓ ${label}: ${res.digest}`);
  return res;
}
