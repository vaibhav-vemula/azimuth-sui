# Azimuth — Setup Guide (Sui + Walrus)

End-to-end: install tooling → publish the Move package → init → run two stations → dashboards.

---

## 0. Prerequisites

- **Node 20+**
- **Sui CLI** — `brew install sui` (or see https://docs.sui.io/guides/developer/getting-started/sui-install)
- **Walrus CLI** (for Walrus Sites only) — see https://docs.wal.app/
- A testnet Sui address with **SUI** (gas) and **WAL** (Walrus storage):
  ```bash
  sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
  sui client switch --env testnet
  sui client active-address
  sui client faucet                      # SUI gas
  # WAL: get from the Walrus testnet faucet / `walrus get-wal`
  ```
- Export a bech32 secret key for the scripts/clients:
  ```bash
  sui keytool export --key-identity $(sui client active-address)   # → suiprivkey1...
  ```

You'll run **three** wallets in a full demo: the **owner/deployer**, **station A**, **station B**.
Create the station keys with `sui client new-address ed25519` and fund each with SUI.

---

## 1. Publish the Move package

```bash
cd move/scripts
./publish.sh
```

This runs `sui move test`, builds, and publishes. With `jq` installed it prints the IDs you need:

```
PACKAGE_ID=0x…
REGISTRY_ID=0x…
ADMIN_CAP_ID=0x…
ACCESS_REGISTRY_ID=0x…
TREASURY_CAP_ID=0x…
```

(If `jq` is missing, open `move/scripts/publish-output.json` and copy the IDs from `objectChanges`.)

---

## 2. Initialize the network (owner)

```bash
cd move/scripts
cp .env.example .env
$EDITOR .env        # paste PACKAGE_ID, REGISTRY_ID, TREASURY_CAP_ID, ADMIN_CAP_ID,
                    # SUI_PRIVATE_KEY (owner), and STATIONS=<addrA>,<addrB>
npm install
node setup.mjs      # funds reward pool + starts PoA epochs + mints stake to each station
```

---

## 3. Register each station (run once per station, with that station's key)

```bash
cd move/scripts
# edit .env: set SUI_PRIVATE_KEY to STATION A's key and LOCATION="New York, USA"
node register.mjs
# repeat with STATION B's key and LOCATION
```

> Optional identity: register SuiNS names at https://suins.io and point them at the station
> addresses — the dashboards resolve them automatically.

---

## 4. Run the station service
 
On each station machine (e.g. a Raspberry Pi), alongside the Python receiver:

```bash
cd sui-client
cp .env.example .env
$EDITOR .env        # SUI_PRIVATE_KEY (this station), PACKAGE_ID, REGISTRY_ID,
                    # ACCESS_REGISTRY_ID, IS_PRIMARY=true on exactly ONE station
npm install
node index.js
```

In another terminal, the hardware capture / UI:

```bash
cd ground_station
python3 azimuth_station.py            # or: python3 azimuth_station.py --no-ui /dev/ttyACM0
```

The Python receiver writes `reception_event.json` (picked up by the sui-client) and reads
`sui_state.json` (written by the sui-client) for its on-screen status panel.

### What each service does
- **heartbeat** → `heartbeat` (PoA).
- **reception** → uploads packets to Walrus (+ Quilt + Seal premium copy) → `submit_porx`.
- **peer verification** → watches `PoRxSubmitted` events, calls `verify_porx` so peers get paid.
- **crank** → calls `settle_poa_epoch` when an epoch is due (`RUN_CRANK=true`).
- **primary station** → merges ≥2 stations' packets → uploads merged image → `record_image`.

---

## 5. Dashboards

```bash
# Station ops (port 3000)
cd dashboard
$EDITOR .env.local      # NEXT_PUBLIC_PACKAGE_ID, NEXT_PUBLIC_REGISTRY_ID
npm install && npm run dev

# Image gallery (port 3001)
cd ../image-dashboard
$EDITOR .env.local      # NEXT_PUBLIC_PACKAGE_ID
npm install && npm run dev
```

Open http://localhost:3000 and enter a station address (or `name.sui`). The gallery at
http://localhost:3001 shows merged images with their Walrus blob id and on-chain certificate.

---

## 6. (Optional) Walrus Sites

See `walrus-sites/README.md` to publish the dashboards as decentralized `.wal.app` sites.

---

## Testing the Move package

```bash
cd move/azimuth
sui move test          # full reward-loop + epoch-timing tests
sui move build
```

## Simulating a reception without hardware

Drop a `ground_station/reception_event.json` shaped like:

```json
{
  "passId": "0x<64 hex>",
  "packetCount": 8,
  "totalPackets": 10,
  "packetHashes": ["0x…", "..."],
  "packetBytes": { "0": "<base64>", "1": "<base64>" },
  "avgRssi": -700,
  "avgSnr": 90,
  "timestamp": "2026-01-01T000000"
}
```

The sui-client will upload to Walrus and submit a PoRx proof. Do this on two stations with
the same `passId` to trigger a merge on the primary.

---

## Troubleshooting

- **"Registry not found"** → check `NEXT_PUBLIC_REGISTRY_ID` / `REGISTRY_ID`.
- **PoRx never pays** → a *second* registered+active station must call `verify_porx`; run both stations.
- **Walrus SDK error** → ensure WAL balance; Quilt/Seal calls are version-sensitive — pin `@mysten/walrus` / `@mysten/seal` to versions matching the docs and adjust `quilt.js` / `seal.js` if the API differs.
- **Epoch never settles** → it only settles after `poa_epoch_interval_ms`; lower it for demos with `set_epoch_interval` (AdminCap).
