# 🛰️ Azimuth → Sui + Walrus — Hackathon Winning Plan

> **Goal:** Pivot Azimuth from Hedera to **Sui + Walrus** and win the **Walrus track** at [Sui Overflow](https://overflow.sui.io/).
>
> **Track thesis (Walrus):** build apps around **large, off-chain, _verifiable_ data**. Azimuth is a near-perfect fit — it produces real-world satellite data that must be *stored, proven available, and trustlessly verified*. We just have to make Walrus + Sui the **core of the system**, not a storage afterthought.

---

## 0. TL;DR — Why this wins

Most Walrus-track submissions are "I uploaded a file to Walrus and saved the blobId in a contract." That is exactly what Azimuth does **today**, and it is not enough.

The winning version of Azimuth is:

> **A DePIN network of real hardware ground stations that capture real satellite downlinks, store every byte on Walrus, register each capture as a Sui object with an on-chain availability certificate, control storage lifecycle (renewal/deletion) from Move, gate premium raw data behind Seal encryption + on-chain payment, batch tiny RF packets with Quilt, and serve its own dashboard from Walrus Sites — so the entire data pipeline, from antenna to UI, is verifiable and decentralized.**

Judges reward: **real-world use case + working demo + deep, non-trivial use of Walrus's _programmable_ features (not just blob storage) + something built to last.** Azimuth checks every box because the data is real (you have the hardware) and the Walrus integration is structural, not cosmetic.

---

## 1. What Azimuth is today (current architecture audit)

| Layer | Today (Hedera) | File(s) |
|---|---|---|
| **Hardware capture** | ESP32 satellite → LoRa/RTL-SDR → Raspberry Pi receives JPEG packets | `ground_station/azimuth_station.py` |
| **Reception event** | Pi writes `reception_event.json` with packet bytes, RSSI/SNR, passId | `azimuth_station.py:write_reception_event` |
| **Station client** | Node service: heartbeats (PoA), PoRx proof submit, image merge | `hedera-client/index.js` |
| **Storage** | Walrus HTTP `PUT`/`GET` (shallow) + legacy Arweave/Irys | `hedera-client/walrus.js`, `packetPublisher.js` |
| **Coordination** | Hedera Consensus Service (HCS) topic — stations announce packets | `packetPublisher.js:postHCS`, `imageMerger.js` |
| **Settlement** | Solidity `OrbitalVault` — staking, PoA/PoRx, rewards, slashing | `contracts/contracts/OrbitalVault.sol` |
| **Autonomy** | Hedera Schedule Service (HSS) — self-settling epochs, timed unstake | `OrbitalVault.sol` (HSS precompile `0x16b`) |
| **Token** | AZM (Hedera Token Service, HTS) | `contracts/scripts/createToken.js` |
| **Identity** | ENS v2 names per station (Sepolia) | `dashboard/lib/ens.js` |
| **Frontends** | Two Next.js dashboards (station ops + image gallery) | `dashboard/`, `image-dashboard/` |

**Core domain logic worth preserving (chain-agnostic):**
- `passId` = sha256 of the pass timestamp (a content key for one satellite pass).
- **PoA (Proof of Availability):** stations heartbeat; per-epoch reward if heartbeats ≥ threshold.
- **PoRx (Proof of Reception):** station submits `{passId, packetCount, totalPackets, packetMerkle, avgRssi, avgSnr}`; reward ∝ packets; cross-verified by a second station.
- **Image merge:** primary station unions packets from ≥2 stations, reconstructs JPEG, records it.
- **Credit score:** off-chain function over heartbeats + PoA + PoRx rewards (`dashboard/lib/creditScore.js`).

We will port this logic to Sui Move and make Walrus do real work at every step.

---

## 2. Target architecture (Sui + Walrus)

```
  ESP32 / RTL-SDR satellite downlink
              │  JPEG packets (RF)
              ▼
   ground_station/azimuth_station.py     ← unchanged hardware capture
              │  reception_event.json
              ▼
   sui-client/  (was hedera-client/)     ← rewritten on @mysten/sui + walrus SDK
   ├─ packets → Quilt → Walrus           (batch tiny packets, content-addressed)
   ├─ register Blob object on Sui        (availability certificate on-chain)
   ├─ submit PoRx → Move call            (proof references the Sui Blob object)
   ├─ heartbeat → Move call (PoA)        (Clock-based epochs)
   └─ merge → final JPEG → Walrus → Move recordImage()
              │
              ▼
   Move package `azimuth::orbital_vault` (Sui testnet)
   ├─ StationRegistry (shared object)    staking, registration, slashing
   ├─ Station (owned/dynamic field)      heartbeats, credit, rewards
   ├─ PoRxProof (object)                 references Walrus Blob object + cert
   ├─ ImageCapture (object)              holds Walrus blob_id + Blob object
   ├─ AZM coin (Coin<AZM>)               rewards via coin::create_currency
   └─ programmable storage: renew/delete Blob objects from Move
              │
              ▼
   Seal (threshold encryption + Move access policy)
   └─ raw high-res captures encrypted; decrypt gated by stake/payment
              │
              ▼
   Walrus Sites  ← dashboard + image-dashboard served fully decentralized
```

### Mapping each Hedera service → Sui/Walrus equivalent

| Hedera (today) | Sui / Walrus (target) | Notes |
|---|---|---|
| Solidity contract (EVM) | **Move package** | Object-centric rewrite |
| HTS token (AZM) | **`Coin<AZM>` via `coin::create_currency`** | Native Sui coin |
| HCS topic (coordination) | **Sui shared object + events** | Stations emit on-chain events; merger reads via RPC/indexer |
| Hedera Schedule Service (autonomous epochs) | **Permissionless crank `entry fun settle_epoch`** gated by `Clock` | Sui has no native scheduler; anyone can crank after the interval (incentivize with a tip). See §6 tradeoffs. |
| Walrus via raw HTTP | **Walrus SDK + on-chain Blob objects + certificates** | The deep integration |
| Arweave/Irys (legacy) | **Deleted** | One storage layer: Walrus |
| ENS identity | **SuiNS names** (or keep ENS as cross-chain flourish) | SuiNS is native; see §7 |

---

## 3. The Walrus integration — go deep (this is the scorecard)

This is where the track is won. We use **six** distinct Walrus/Sui-data capabilities, each tied to a real product need — not bolted on.

### 3.1 On-chain Blob objects + availability certificates (the headline)
- Upload packet/image blobs with the **Walrus SDK** (not raw HTTP), which registers a **`Blob` Move object on Sui** and returns an **availability certificate**.
- Store the **`Blob` object (or its ID + certificate)** inside the Azimuth `ImageCapture` / `PoRxProof` Move object.
- A station's PoRx is only valid if it references a **certified, on-chain-available** blob. This is literally "proof of reception" backed by "proof of availability" — the data is provably retrievable, not just hashed.
- **Why it wins:** moves Azimuth from "hash on chain" to "the actual data is verifiably available on chain," the exact Walrus thesis.

### 3.2 Programmable storage lifecycle (renew / delete from Move)
- Satellite captures have **tiered value**: a routine pass can expire after a few epochs; a flagged capture (wildfire, storm, eclipse) should persist for years.
- Move logic decides retention: `renew_blob()` extends storage epochs (pays WAL) for high-value captures; routine blobs lapse.
- **Why it wins:** demonstrates Walrus *programmability* — storage controlled by smart-contract policy, not a manual CLI.

### 3.3 Quilt — batch the tiny RF packets
- Each satellite pass = dozens/hundreds of **small** base64 packets (`packetBytes` in `azimuth_station.py`). Storing each as its own blob is wasteful (erasure-coding overhead dominates small blobs).
- Use **Quilt** to batch all packets of a pass into one Walrus storage unit, retrieving individual packets by identifier.
- **Why it wins:** shows you understand Walrus economics and picked the *right* primitive for small-object workloads — a sophistication signal.

### 3.4 Seal — encrypted premium data + on-chain access control
- **Free tier:** thumbnail / low-res merged JPEG, public on Walrus.
- **Premium tier:** full-resolution raw capture + raw IQ packets, **Seal-encrypted**. Decryption key is released only when a **Move access policy** passes — e.g., caller staked AZM, or paid for the capture, or is the capturing station.
- This creates a **decentralized satellite-data marketplace**: operators monetize captures; buyers get verifiable, access-controlled data.
- **Why it wins:** Seal is a flagship Walrus-ecosystem feature; pairing it with a real monetization model is exactly "built to last."

### 3.5 Walrus Sites — decentralized frontend
- Deploy both Next.js dashboards (static export) as **Walrus Sites**. The whole stack — data, logic, UI — lives on Sui + Walrus. No centralized host.
- **Why it wins:** judges love an end-to-end decentralized demo; it's a quick, high-visibility win.

### 3.6 Verifiable provenance chain
- Per capture, anchor on Sui: `passId`, `packetMerkle`, station signatures, RSSI/SNR, Walrus `blob_id` + certificate, merge inputs. Anyone can independently re-fetch the blob from Walrus and re-verify the Merkle root → **end-to-end verifiable data provenance** from antenna to chain.

---

## 4. Move contract design (`azimuth::orbital_vault`)

Port `OrbitalVault.sol` to idiomatic Sui Move. Sketch (not final code):

```move
module azimuth::orbital_vault {
    use sui::object::{UID};
    use sui::clock::Clock;
    use sui::coin::{Coin};
    use sui::balance::Balance;
    use walrus::blob::Blob;          // Walrus Move type for on-chain blob objects

    /// One-time witness coin: AZM rewards token
    public struct AZM has drop {}

    /// Shared registry — global network state
    public struct StationRegistry has key {
        id: UID,
        owner: address,
        reward_pool: Balance<AZM>,
        poa_epoch_interval_ms: u64,
        poa_epoch_count: u64,
        poa_epoch_start_ms: u64,
        stake_amount: u64,
        heartbeat_threshold: u64,
        // dynamic fields: address -> Station
    }

    /// Per-station record (dynamic field of registry, or owned object)
    public struct Station has store {
        active: bool,
        location: vector<u8>,
        staked: Balance<AZM>,
        last_heartbeat_ms: u64,
        heartbeat_count: u64,
        total_poa_rewards: u64,
        total_porx_rewards: u64,
    }

    /// Proof of Reception — references a certified Walrus blob
    public struct PoRxProof has key, store {
        id: UID,
        station: address,
        pass_id: vector<u8>,
        packet_count: u16,
        total_packets: u16,
        packet_merkle: vector<u8>,
        avg_rssi: u16,
        avg_snr: u16,
        walrus_blob_id: u256,        // content-addressed packet blob (Quilt)
        verified: bool,
        paid: bool,
    }

    /// Final merged image — holds the Walrus Blob object for lifecycle control
    public struct ImageCapture has key, store {
        id: UID,
        pass_id: vector<u8>,
        blob: Blob,                  // OWN the Walrus blob object → renew/delete
        recovered: u16,
        total: u16,
        high_value: bool,            // policy: keep long-term?
        submitter: address,
    }

    // ── Entry functions (mirror Solidity) ──
    public entry fun register_station(reg: &mut StationRegistry, stake: Coin<AZM>, location: vector<u8>, ctx: &mut TxContext) { /* ... */ }
    public entry fun heartbeat(reg: &mut StationRegistry, clock: &Clock, ctx: &mut TxContext) { /* ... */ }
    public entry fun settle_poa_epoch(reg: &mut StationRegistry, clock: &Clock, ctx: &mut TxContext) { /* permissionless crank */ }
    public entry fun submit_porx(reg: &mut StationRegistry, pass_id: vector<u8>, /* ... */, walrus_blob_id: u256, ctx: &mut TxContext) { /* ... */ }
    public entry fun verify_porx(proof: &mut PoRxProof, ctx: &mut TxContext) { /* second station attests */ }
    public entry fun record_image(reg: &mut StationRegistry, pass_id: vector<u8>, blob: Blob, recovered: u16, total: u16, ctx: &mut TxContext) { /* wraps Walrus Blob */ }
    public entry fun renew_capture(cap: &mut ImageCapture, wal: Coin<WAL>, epochs: u32, ctx: &mut TxContext) { /* programmable storage */ }

    // ── Events (replace HCS coordination) ──
    public struct PacketsAnnounced has copy, drop { pass_id: vector<u8>, station: address, walrus_blob_id: u256, packet_count: u16, total_packets: u16 }
    public struct ImageMerged has copy, drop { pass_id: vector<u8>, walrus_blob_id: u256, recovered: u16, total: u16 }
}
```

Key Move-specific decisions:
- **Token:** `coin::create_currency<AZM>` (one-time witness) replaces HTS. Mint a treasury, fund the registry `reward_pool`.
- **Time:** `sui::clock::Clock` (shared `0x6`) replaces `block.timestamp`.
- **Coordination:** emit `PacketsAnnounced` / `ImageMerged` **events** instead of HCS messages; the merger subscribes via Sui RPC / a light indexer.
- **Autonomy:** no HSS — `settle_poa_epoch` is **permissionless** and only succeeds when `clock.timestamp_ms >= epoch_start + interval`. Anyone (incl. a cron in `sui-client`) can call it; optionally pay the caller a small tip from the pool. (See §6.)
- **Objects over mappings:** `PoRxProof` and `ImageCapture` are first-class Sui objects (discoverable, transferable, composable) instead of nested Solidity mappings.

---

## 5. Migration plan — phased, end to end

> Estimate assumes one focused builder. Compress by parallelizing Move + client work.

### Phase 0 — Setup & spike (½–1 day)
- [ ] Install Sui CLI, Walrus CLI, get testnet SUI + WAL from faucets.
- [ ] `git checkout -b sui-walrus` (don't break the working Hedera `main`).
- [ ] Spike: upload a file with the **Walrus SDK** (`@mysten/walrus`), confirm you get a **Blob object ID + availability certificate** on Sui testnet. Read it back. This de-risks everything.
- [ ] Spike: `sui move new azimuth`, publish a hello-world module to testnet.

### Phase 1 — Move package (2–3 days)
- [ ] Scaffold `move/azimuth/` package; define structs from §4.
- [ ] Implement: `create_currency<AZM>`, `register_station` + staking, `heartbeat`, `settle_poa_epoch` (Clock crank), `submit_porx`, `verify_porx`, `record_image`, `renew_capture`, `slash`.
- [ ] Emit `PacketsAnnounced` / `ImageMerged` events.
- [ ] Unit tests (`sui move test`) for staking, epoch settlement, PoRx reward math, double-submit guard, verify-before-pay.
- [ ] Publish to testnet; save package ID + shared object IDs.
- [ ] Port deploy/init scripts: `contracts/scripts/{createToken,deploy,fundContract,registerStations,initPoAEpoch}.js` → Sui TS SDK equivalents in `move/scripts/`.

### Phase 2 — Station client rewrite (`hedera-client/` → `sui-client/`) (2–3 days)
- [ ] New `config.js`: `@mysten/sui` client + keypair + Walrus SDK client (replace ethers + HTS).
- [ ] `walrus.js`: replace raw HTTP with **Walrus SDK** — return `{blobId, blobObjectId, certificate}`; add `renewBlob()`.
- [ ] `quilt.js` (new): batch a pass's packets into one Quilt; store; retrieve by packet id.
- [ ] `packetPublisher.js`: upload packets via Quilt → call `submit_porx` Move tx → emit event (replaces `postHCS` + Arweave).
- [ ] `imageMerger.js`: subscribe to `PacketsAnnounced` **events** (replace Mirror Node HCS polling); merge ≥2 stations; reconstruct JPEG; upload to Walrus; call `record_image` (wraps the `Blob` object).
- [ ] `heartbeat.js` / `proofSubmitter.js` / `scheduleTracker.js`: point at Move entry fns + Sui events.
- [ ] `stateWriter.js`: keep — still writes `*_state.json` for the Pygame UI (just source from Sui). **`ground_station/azimuth_station.py` needs no changes.**
- [ ] Delete: `irys-upload-*.tgz`, `testIrys.js`, Arweave paths, `abi.js` (Solidity ABI).

### Phase 3 — Seal premium tier (1–2 days)
- [ ] Define a Move **access policy** module: `seal_approve` checks staker/payer/owner.
- [ ] Encrypt full-res capture + raw packets with Seal before Walrus upload.
- [ ] Add `buy_access` / payment entry fn that grants decryption rights.
- [ ] Demo: free thumbnail vs. paywalled raw capture.

### Phase 4 — Frontends (1–2 days)
- [ ] Replace `dashboard/lib/contract.js` (ethers + ABI) with `@mysten/sui` reads of registry/Station objects + event queries.
- [ ] Replace `image-dashboard` blob route to read Walrus via SDK/aggregator; show **blob ID + on-chain certificate link** per image (visible proof of availability).
- [ ] `creditScore.js` / `utils.js`: keep (chain-agnostic; just feed Sui data).
- [ ] Wallet: integrate **Sui dApp Kit** (Sui Wallet / Slush) for connect + premium purchase.
- [ ] **SuiNS** for station identity (replace or complement ENS).

### Phase 5 — Walrus Sites + polish (1 day)
- [ ] Static-export both dashboards; deploy via `site-builder` to **Walrus Sites**; get the `.wal.app` URLs.
- [ ] End-to-end dry run on real hardware: capture → Quilt → Walrus → Sui → merge → Walrus Site shows verified image.

### Phase 6 — Submission package (1 day)
- [ ] Rewrite `README.md` around the Sui/Walrus story (this plan → product README).
- [ ] 2–3 min demo video (real hardware capture is your unfair advantage — show the antenna).
- [ ] Architecture diagram, deployed object IDs, Walrus Site URL, GitHub.
- [ ] Submit on the official platform under the **Walrus track**.

---

## 6. Hard tradeoffs & how to handle them (be honest in the submission)

1. **No Hedera Schedule Service equivalent.** Sui has no native on-chain scheduler. Replace autonomous epochs with a **permissionless `settle_poa_epoch` crank** guarded by `Clock`: anyone can call it once the interval elapses; the `sui-client` runs it on a timer, and you can pay the caller a tip from the pool so it's economically self-sustaining. Frame this as *permissionless* settlement (a feature), not a regression.
2. **HCS → events.** HCS gave ordered, queryable messages. Sui events are queryable via RPC/indexer but you may want a tiny indexer (or just poll `queryEvents`) in the merger. Keep it simple: poll `PacketsAnnounced` since last cursor (mirrors current `fetchHCSMessages` pattern).
3. **Walrus testnet stability / epochs.** Testnet blobs expire; use enough epochs for judging window and demonstrate `renew_blob`. Pin the exact blobs used in the demo.
4. **Content-addressing collision.** Your code already appends a per-pass marker after JPEG EOI so identical test images get unique blob IDs (`imageMerger.js:220`). Keep this — and mention it; it shows you understand content addressing.
5. **Don't over-scope.** Phases 1–2 + 5 are the **must-haves** (real, deep Walrus + working demo). Seal (Phase 3) and Walrus Sites are **high-leverage differentiators**. If time is short, ship 3.1/3.2/3.3 + 3.5 and treat Seal as stretch.

---

## 7. Keep, drop, or change

| Component | Decision |
|---|---|
| `ground_station/azimuth_station.py` (hardware) | **Keep as-is** — your moat. Only the state JSON source changes. |
| Domain logic (PoA/PoRx/merge/credit) | **Keep** — port to Move + Sui reads. |
| Arweave / Irys | **Drop** — single storage layer (Walrus). |
| Hedera contract / HTS / HCS / HSS | **Replace** with Move / Coin / events / crank. |
| ENS | **Optional:** switch to **SuiNS** (native, cleaner story) or keep ENS as a cross-chain identity flourish. Recommend SuiNS for track focus. |
| Two dashboards | **Keep**, re-wire to Sui, host on **Walrus Sites**. |

---

## 8. Judging-criteria scorecard (map every feature to a point)

| What judges reward | How Azimuth delivers |
|---|---|
| **Real-world use case** | Real RF hardware capturing real satellites — not a toy. |
| **Working demo** | Live capture → Walrus → Sui → verified image on a Walrus Site. |
| **Deep Walrus use (beyond storage)** | On-chain Blob objects + certificates, programmable renewal, Quilt batching, Seal access control, Walrus Sites — *five* programmable features. |
| **Verifiable data** | Re-fetch any blob, re-check Merkle root vs. on-chain proof. |
| **Sui-native design** | Object model (captures/proofs as objects), `Coin<AZM>`, `Clock`, events. |
| **Built to last** | Seal-gated data marketplace = real monetization for operators. |
| **Polish** | Two dashboards, SuiNS identity, decentralized hosting. |

---

## 9. Immediate next actions (do these first)

1. `git checkout -b sui-walrus`
2. Install Sui CLI + Walrus CLI; fund testnet wallet (SUI + WAL).
3. **Spike the Walrus SDK upload** — confirm you get a Sui `Blob` object + certificate (Phase 0). This single spike validates the whole thesis.
4. `sui move new azimuth` and stub the structs in §4.
5. Verify the official **Walrus track problem statement + submission deadline** on the hackathon site (the rules page below) before committing scope.

---

## 10. References

- Sui Overflow hackathon — https://overflow.sui.io/
- Walrus track problem statement — https://mystenlabs.notion.site/walrus-track-problem-statement
- Walrus docs — https://docs.wal.app/
- How Walrus blob storage / programmability works — https://www.walrus.xyz/blog/how-walrus-blob-storage-works
- Walrus smart contracts (Move) — https://deepwiki.com/MystenLabs/walrus/2.3-smart-contracts
- Seal (encryption + access control) — https://seal-docs.wal.app/GettingStarted/
- Walrus + Sui data stack — https://docs.sui.io/sui-stack/walrus/sui-stack-walrus
- Sui Move book — https://move-book.com/
- 2025 Overflow winners (study the bar) — https://blog.sui.io/2025-sui-overflow-hackathon-winners/

---

*This plan keeps your working Hedera build on `main` and pivots a `sui-walrus` branch. Your hardware is the unfair advantage — Walrus + Sui make the data it produces verifiable, programmable, and monetizable.*
