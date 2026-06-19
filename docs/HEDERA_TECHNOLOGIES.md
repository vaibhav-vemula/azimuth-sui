# Hedera Technologies Used in Azimuth

---

## Hedera Smart Contract Service (HSCS)

Azimuth's entire reward engine runs as EVM-compatible Solidity contracts on Hedera.

- **OrbitalVault.sol** — manages HBAR staking, PoA epoch tracking, PoRx proof storage, image recording, and AZM token payouts. Callable by anyone — no admin, no intermediary.
- **CreditRegistry.sol** — stores every operator's credit profile and settlement history on-chain. Computes credit score and reward multiplier as pure view functions from live on-chain data.
- **AzimuthToken.sol** — ERC-20 reward token (AZM) deployed on Hedera EVM. 10,000,000 fixed supply.

**Why it matters:** Smart contracts execute reward logic automatically. No human decides who gets paid or how much — the contract does, every epoch, forever.

---

## Hedera Consensus Service (HCS)

HCS is the coordination backbone between ground stations. Stations never communicate directly — all coordination flows through an HCS topic.

- Station A uploads packet data to Arweave, posts `{ type: "packets", passId, arweaveTxId }` to the HCS topic
- Station B does the same
- The primary station polls the Mirror Node, detects both announcements, downloads both datasets, merges them, and posts `{ type: "merged-image", arweaveTxId }` back to HCS
- The image dashboard reads these messages to display the permanent image archive

**Why it matters:** HCS gives every message an immutable, consensus-ordered timestamp. The coordination record is public, permanent, and tamper-proof.

---

## Hedera Scheduled Transactions (HSS)

PoA epoch settlement is triggered via Hedera's native scheduled transaction mechanism — fully on-chain automation with no off-chain keeper infrastructure required.

- `settlePoAEpoch()` is callable by anyone once the epoch interval elapses
- Evaluates every registered station, calculates `base reward × credit multiplier`, and transfers AZM automatically

**Why it matters:** Reward payouts are trustless and permissionless. No cron job, no server, no human trigger — the network settles itself.

---

## Hedera Mirror Node

Both dashboards are powered entirely by the Hedera Mirror Node REST API — no backend, no database.

- **Ground station dashboard** — queries contract state, PoA epoch progress, credit scores, and scheduled transaction status
- **Image archive dashboard** — scans the HCS topic for `merged-image` messages to build the full image gallery
- **`checkBalances.js`** — queries HBAR and AZM balances for both stations and the contract in real time

**Why it matters:** Free, unauthenticated, real-time queries over all on-chain and HCS data. The entire Azimuth frontend runs with zero backend infrastructure.

---

## Hedera Token Service (HTS) — Interoperability

AZM is deployed as an ERC-20 on Hedera EVM, with full HTS interoperability. Token transfers, balances, and associations are queryable natively through the Mirror Node alongside HBAR balances — unified token infrastructure with no additional tooling.

---

## Summary

| Technology | Role in Azimuth |
|-----------|-----------------|
| **HSCS** | Reward logic, staking, PoA/PoRx proofs, credit scoring |
| **HCS** | Trustless inter-station coordination, permanent reception log |
| **HSS** | Automated epoch settlement and reward payouts |
| **Mirror Node** | Powers both dashboards and balance monitoring — no backend |
| **HTS / EVM** | AZM token — unified with HBAR in a single token ecosystem |
