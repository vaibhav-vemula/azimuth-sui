/**
 * register.mjs — Register THIS station (run with the station's own key).
 *
 * Reads the registry's stake_amount, picks the station's AZM coin(s), splits the
 * exact stake, and calls orbital_vault::register_station.
 *
 * Env: SUI_PRIVATE_KEY (station), PACKAGE_ID, REGISTRY_ID, LOCATION
 */
import { Transaction } from "@mysten/sui/transactions";
import { suiClient, keypair, env, exec } from "./lib.mjs";

const PKG = env("PACKAGE_ID");
const REGISTRY = env("REGISTRY_ID");
const LOCATION = env("LOCATION", "Unknown");
const AZM = `${PKG}::azm::AZM`;

async function main() {
  const signer = keypair();
  const addr = signer.toSuiAddress();

  // Read the required stake amount.
  const reg = await suiClient.getObject({ id: REGISTRY, options: { showContent: true } });
  const stake = BigInt(reg.data.content.fields.stake_amount);

  // Gather this station's AZM coins.
  const { data: coins } = await suiClient.getCoins({ owner: addr, coinType: AZM });
  if (coins.length === 0) throw new Error(`No AZM coins for ${addr} — run setup.mjs with this address in STATIONS.`);
  const total = coins.reduce((a, c) => a + BigInt(c.balance), 0n);
  if (total < stake) throw new Error(`Insufficient AZM: have ${total}, need ${stake}.`);

  const tx = new Transaction();
  const primary = tx.object(coins[0].coinObjectId);
  if (coins.length > 1) tx.mergeCoins(primary, coins.slice(1).map((c) => tx.object(c.coinObjectId)));
  const [stakeCoin] = tx.splitCoins(primary, [tx.pure.u64(stake)]);

  tx.moveCall({
    target: `${PKG}::orbital_vault::register_station`,
    arguments: [tx.object(REGISTRY), stakeCoin, tx.pure.string(LOCATION), tx.object("0x6")],
  });

  await exec(tx, signer, `register_station (${addr} @ "${LOCATION}")`);
}

main().catch((e) => { console.error(e); process.exit(1); });
