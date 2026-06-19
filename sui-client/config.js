/**
 * config.js — Shared Sui client, keypair, and Walrus client.
 *
 * Replaces the Hedera ethers/@hashgraph setup. All on-chain calls go through
 * `suiClient` + `keypair`; all storage goes through `walrusClient`.
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { WalrusClient } from "@mysten/walrus";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

function required(name) {
  const v = process.env[name];
  if (!v || v.startsWith("0x...") || v.includes("suiprivkey1...")) {
    console.error(`ERROR: ${name} not set in sui-client/.env`);
    process.exit(1);
  }
  return v;
}

export const NETWORK = process.env.SUI_NETWORK || "testnet";

export const suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });
export const keypair = Ed25519Keypair.fromSecretKey(required("SUI_PRIVATE_KEY"));
export const address = keypair.toSuiAddress();

export const walrusClient = new WalrusClient({ network: NETWORK, suiClient });

export const PACKAGE_ID = required("PACKAGE_ID");
export const REGISTRY_ID = required("REGISTRY_ID");
export const ACCESS_REGISTRY_ID = process.env.ACCESS_REGISTRY_ID || null;
export const CLOCK_ID = "0x6"; // shared system Clock

export const IS_PRIMARY = process.env.IS_PRIMARY === "true";
export const RUN_CRANK = process.env.RUN_CRANK !== "false";
export const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL_MS || "60000");
export const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "15000");
export const SEAL_THRESHOLD = parseInt(process.env.SEAL_THRESHOLD || "2");
export const WALRUS_EPOCHS = parseInt(process.env.WALRUS_EPOCHS || "5");

export const STATE_FILE = path.resolve(
  __dirname,
  process.env.STATE_FILE || "../ground_station/sui_state.json"
);
export const EVENT_FILE = path.resolve(__dirname, "../ground_station/reception_event.json");

/** RSSI/SNR come in as signed (×10) ints; Move stores them as u16, so offset. */
export const SIGNED_OFFSET = 32768;
