/**
 * setup.mjs — One-shot init after publishing:
 *   - mint AZM into the reward pool (orbital_vault::fund)
 *   - start the PoA epoch clock (orbital_vault::start_poa)
 *   - mint stake coins to each station address in STATIONS
 *
 * Run by the deployer (owner) key. All in a single PTB.
 */
import { Transaction } from "@mysten/sui/transactions";
import { suiClient, keypair, env, exec } from "./lib.mjs";

const PKG = env("PACKAGE_ID");
const REGISTRY = env("REGISTRY_ID");
const TREASURY = env("TREASURY_CAP_ID");
const ADMIN = env("ADMIN_CAP_ID");
const POOL = BigInt(env("POOL_AMOUNT", "100000000"));
const STAKE = BigInt(env("STAKE_AMOUNT", "100"));
const STATIONS = env("STATIONS", "").split(",").map((s) => s.trim()).filter(Boolean);

const AZM = `${PKG}::azm::AZM`;

async function main() {
  const signer = keypair();
  const tx = new Transaction();

  // Fund the reward pool: mint → fund (no intermediate transfer).
  const poolCoin = tx.moveCall({ target: "0x2::coin::mint", typeArguments: [AZM], arguments: [tx.object(TREASURY), tx.pure.u64(POOL)] });
  tx.moveCall({ target: `${PKG}::orbital_vault::fund`, arguments: [tx.object(REGISTRY), poolCoin] });

  // Start the epoch clock.
  tx.moveCall({ target: `${PKG}::orbital_vault::start_poa`, arguments: [tx.object(REGISTRY), tx.object("0x6"), tx.object(ADMIN)] });

  // Pre-fund each station with stake.
  for (const addr of STATIONS) {
    const c = tx.moveCall({ target: "0x2::coin::mint", typeArguments: [AZM], arguments: [tx.object(TREASURY), tx.pure.u64(STAKE)] });
    tx.transferObjects([c], tx.pure.address(addr));
  }

  await exec(tx, signer, "setup (fund + start_poa + distribute stake)");
  console.log(`Reward pool: ${POOL} AZM | Stations funded: ${STATIONS.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
