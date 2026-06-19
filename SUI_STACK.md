# 🧱 The Sui Stack in Azimuth

A plain-English guide to every Sui-ecosystem technology Azimuth uses, **what it is**, and
**exactly how and where Azimuth uses it**. Read this top-to-bottom to understand the whole
system, or jump to a layer.

> One-line mental model:
> **Sui** is the settlement + logic layer (who did what, who gets paid) ·
> **Walrus** is the data layer (the actual satellite bytes, provably available) ·
> **Seal / SuiNS / Walrus Sites** are the access-control, identity, and hosting layers on top.

---

## 1. Sui (the L1 blockchain)

**What it is.** A high-throughput Layer-1 where state is modeled as **objects** (not account
balances in a big map). Each object has a unique ID, an owner, and a type defined in **Move**.
Transactions operate on objects directly, which makes ownership, composability, and parallel
execution natural.

**How Azimuth uses it.** Sui is the trust backbone — the replacement for the old Hedera EVM
contract. Every meaningful action (a heartbeat, a proof, a reward, a recorded image) is a Sui
transaction against our Move package, and every important record is a first-class Sui object
anyone can inspect.

- Package: `move/azimuth/`
- Network config + client: `sui-client/config.js`, `dashboard/lib/sui.js`

---

## 2. Move (the smart-contract language)

**What it is.** A resource-oriented language where assets are *typed values that can't be copied
or silently dropped*. This makes financial logic safe by construction (you can't duplicate a
coin or a stake).

**How Azimuth uses it.** Our entire reward engine — ported from `OrbitalVault.sol` — is Move:

- `move/azimuth/sources/orbital_vault.move` — staking, PoA, PoRx, image records, slashing.
- `move/azimuth/sources/azm.move` — the AZM reward coin.
- `move/azimuth/sources/access_policy.move` — Seal access policy.
- Tests: `move/azimuth/tests/orbital_vault_tests.move`.

---

## 3. Sui object model (owned & shared objects)

**What it is.** Objects are either **owned** (by one address) or **shared** (anyone can submit
transactions touching them, ordered by consensus). Choosing owned vs. shared is a core design
decision.

**How Azimuth uses it.**
- **`StationRegistry`** — a **shared** object holding the AZM reward pool, the station table, and
  epoch parameters. Every station interacts with this one shared registry.
- **`PoRxProof`** — a **shared** object, so a *different* station can call `verify_porx` on it
  (a second party must be able to mutate it to attest the reception).
- **`ImageCapture`** — a **shared** object so the gallery and anyone else can read a merged
  image's Walrus blob id + certificate.
- **`AdminCap`** — an **owned** capability object given to the deployer; holding it is what
  authorizes admin actions (a "capability" pattern instead of an `onlyOwner` address check).

This is a direct upgrade over Solidity's nested `mapping`s: proofs and images are now real,
discoverable, composable objects.

---

## 4. `Coin<T>` & the AZM token (`coin::create_currency`)

**What it is.** Sui's native fungible-token standard. A one-time witness type creates a currency
and yields a `TreasuryCap` (mint authority) + immutable metadata. Tokens are just `Coin<T>`
objects you can split, merge, and transfer.

**How Azimuth uses it.** Replaces the Hedera HTS token.
- `azm.move` defines `AZM` and mints via `coin::create_currency` (8 decimals).
- Stations stake `Coin<AZM>` (`register_station`); rewards are paid by `coin::take`-ing from the
  registry's `Balance<AZM>` pool and transferring to the station.
- The deployer funds the pool with `setup.mjs` (mint → `fund`).

---

## 5. The `Clock` (on-chain time)

**What it is.** A shared system object at address `0x6` exposing the current time in
milliseconds — Move has no `block.timestamp`, so time comes from `Clock`.

**How Azimuth uses it.** Heartbeats, epoch settlement, and the unstake cooldown all read the
`Clock`:
- `heartbeat`, `settle_poa_epoch`, `request_unstake`, `complete_unstake` all take `&Clock`.
- Passed as `tx.object("0x6")` from `sui-client/sui.js` and the dashboard wallet actions.

**Why it matters here.** Sui has **no native scheduler** (unlike Hedera's Schedule Service), so
epochs can't "fire themselves." Instead `settle_poa_epoch` is **permissionless**: anyone can call
it once `Clock` shows the interval has elapsed, and the `sui-client` runs it on a timer
(the "crank"). Framed as a feature: settlement is open to anyone, not a privileged cron.

---

## 6. Events

**What it is.** Move functions can `event::emit(...)` structured events that off-chain code reads
via RPC (`queryEvents`). They're the canonical way to stream on-chain activity.

**How Azimuth uses it.** Events **replace the Hedera HCS coordination topic** entirely:
- `PoRxSubmitted` carries `{station, pass_id, proof_id, packet_count, walrus_blob_id}` — this is
  how the primary station discovers which stations have data for a pass and where it lives.
- `ImageMerged` tells the gallery a new image exists (with its blob id + capture object).
- `HeartbeatEmitted`, `PoAEpochSettled`, `PoAReward`, `PoRxVerified` feed the dashboards.
- Consumed in `sui-client/imageMerger.js`, `sui-client/eventTracker.js`,
  `dashboard/lib/sui.js`, `image-dashboard/lib/walrus.js`.

---

## 7. Programmable Transaction Blocks (PTBs)

**What it is.** A single Sui transaction can chain multiple Move calls and pass the *output* of
one as the *input* of the next, atomically. This is the `Transaction` builder in the SDK.

**How Azimuth uses it.**
- Every client write builds a PTB in `sui-client/sui.js` (e.g. `submit_porx`, `verify_porx`,
  `record_image`).
- `setup.mjs` uses one PTB to **mint → fund the pool → start epochs → distribute stake** in a
  single atomic transaction.
- `register.mjs` merges/splits the station's AZM coins and registers — all in one PTB.

---

## 8. Walrus (decentralized blob storage) — the heart of the project

**What it is.** A decentralized storage network for large binary blobs that uses **Sui for
coordination**: when you store a blob, Walrus registers a **`Blob` object on Sui** and produces an
**availability certificate** proving the data is actually stored and retrievable. Storage is paid
in **WAL** and lasts for a number of **epochs**. Blobs are **content-addressed** (the same bytes
always yield the same blob id).

**How Azimuth uses it.** Walrus is *the* storage layer — every satellite byte lives here:
- Each station uploads its raw packets to Walrus (`sui-client/walrus.js`, via `@mysten/walrus`).
- The primary station uploads the reconstructed JPEG to Walrus and anchors it on-chain.
- The blob id + certified epoch are stored in the `ImageCapture` Move object, so a proof of
  reception is **backed by a proof of availability** — the exact theme of the Walrus track.
- The gallery reads images straight from the Walrus aggregator and links to the on-chain
  certificate (`image-dashboard/lib/walrus.js`, `image-dashboard/app/api/blob/[blobId]/route.js`).
- Content-addressing note: identical test images would collide, so the merger appends a per-pass
  marker after the JPEG's end-of-image bytes to keep each pass's blob id unique
  (`sui-client/imageMerger.js`).

**Why it beats the old approach.** Previously Azimuth used Walrus as a dumb HTTP bucket
(`PUT`/`GET`) and just saved a string. Now Walrus is *programmable and verifiable*: on-chain blob
objects, certificates, and lifecycle control.

---

## 9. Walrus Quilt (batching small blobs)

**What it is.** Walrus pays a fixed erasure-coding overhead per blob, which is wasteful for many
*tiny* files. **Quilt** packs many small pieces into one storage unit while still letting you
address each piece by identifier.

**How Azimuth uses it.** A satellite pass produces dozens/hundreds of small base64 packets — a
textbook Quilt workload. `sui-client/quilt.js` batches a pass's packets into a single Quilt
instead of one blob per packet, demonstrating that we picked the right Walrus primitive for the
data shape (not just the default one).

---

## 10. Walrus storage lifecycle (renewal / retention)

**What it is.** Blob storage is time-bounded (in epochs) and can be **extended** by paying more
WAL — so retention can be driven by policy, not manual babysitting.

**How Azimuth uses it.** Captures are tiered: a routine pass can expire, but a high-completeness
capture is flagged `high_value` (`record_image` in `orbital_vault.move`) and can be renewed
(`renewBlob` in `sui-client/walrus.js`). This shows storage controlled by smart-contract logic —
"programmable storage."

---

## 11. Seal (threshold encryption + on-chain access control)

**What it is.** A client-side encryption system where the **decryption policy is a Move
function**. Key servers only release decryption shares if your transaction passes an on-chain
`seal_approve(...)` check — so who can read data is enforced by smart-contract logic, not a
central server.

**How Azimuth uses it.** It powers a **premium data tier / marketplace**:
- Free tier: the low-res merged image is public on Walrus.
- Premium tier: the full-res / raw capture is **Seal-encrypted** before upload
  (`sui-client/seal.js`), keyed to the pass id.
- `access_policy.move` defines `buy_access` (pay in SUI to get access) and `seal_approve`, which
  grants decryption only to the capturing station/owner or a paid buyer.
- Result: operators can monetize their captures, and access is trustlessly enforced on-chain.

---

## 12. SuiNS (Sui Name Service)

**What it is.** Human-readable `name.sui` names that resolve to addresses (and reverse). Resolution
is built into the Sui SDK — no extra contracts needed for read access.

**How Azimuth uses it.** Replaces ENS for station identity. The dashboards resolve and display
station names instead of raw addresses:
- `dashboard/lib/suins.js`, `image-dashboard/lib/suins.js` use the SDK's
  `resolveNameServiceAddress` / `resolveNameServiceNames`.
- A station can be loaded by `name.sui` or `0x…` in the header.

---

## 13. Walrus Sites (decentralized frontend hosting)

**What it is.** A way to host static websites *on Walrus itself*, served at a `…wal.app` URL via
a Sui object — no centralized web host.

**How Azimuth uses it.** The dashboards can be published as Walrus Sites so the entire stack —
data, logic, and UI — is decentralized end to end. Configs and instructions live in
`walrus-sites/` (the station dashboard is the cleanest candidate since all its reads are
client-side).

---

## 14. The Mysten SDKs (how the app talks to all of the above)

| SDK | Package | Role in Azimuth | Where |
|---|---|---|---|
| **Sui TypeScript SDK** | `@mysten/sui` | Build/sign PTBs, read objects & events, SuiNS resolution | `sui-client/*`, `dashboard/lib/sui.js`, `move/scripts/*` |
| **Walrus SDK** | `@mysten/walrus` | Upload/read blobs, register Blob objects, Quilt, renewal | `sui-client/walrus.js`, `quilt.js` |
| **Seal SDK** | `@mysten/seal` | Encrypt premium captures against the Move policy | `sui-client/seal.js` |
| **dApp Kit** | `@mysten/dapp-kit` | Wallet connect + sign txs in the browser (e.g. unstake, buy access) | `dashboard/components/Providers.js`, `ScheduleCreator.js` |
| **BCS** | `@mysten/bcs` | Binary encode/decode for Move values when needed | `sui-client/` |

> SDK note: the Walrus/Seal APIs evolve between versions. Those calls are isolated in
> `walrus.js` / `quilt.js` / `seal.js` so you only adjust one file if you pin a different version.

---

## How it all flows together (one pass)

1. **Hardware** (`ground_station/azimuth_station.py`) receives JPEG packets → writes a reception event.
2. **sui-client** uploads packets to **Walrus** (+ **Quilt**, + a **Seal**-encrypted premium copy),
   then submits a **PoRx** proof in a **PTB** → emits a **`PoRxSubmitted` event**.
3. A second station reads that **event** and calls `verify_porx` → reward paid in **`Coin<AZM>`**
   from the **shared `StationRegistry`**.
4. Meanwhile **heartbeats** accrue PoA; the permissionless **crank** settles epochs using the **`Clock`**.
5. The primary station merges ≥2 stations' packets, uploads the final image to **Walrus**, and
   `record_image` creates an **`ImageCapture` object** anchoring the blob id + **availability certificate**.
6. The **dashboards** (optionally hosted on **Walrus Sites**, identities via **SuiNS**) render
   everything — and let a buyer pay via **dApp Kit** to **Seal**-decrypt premium data.

**Net result:** from antenna to UI, every byte is stored on Walrus, every claim is provable on
Sui, and the data is verifiable, programmable, and monetizable — exactly what the Walrus track
asks for.
