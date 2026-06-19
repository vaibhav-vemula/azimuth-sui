# Azimuth × Hedera Schedule Service — Use Case

## Self-Running Satellite Data Rewards Engine

---

## The Problem

Satellite ground station networks need to:
1. Keep stations online and ready 24/7 — even when no satellite is overhead
2. Reward stations for successfully capturing satellite data
3. Verify that captured data is legitimate (not fabricated)
4. Handle staking, unstaking, and slashing

**Traditionally**, all of this requires a centralized backend server running cron jobs — a single point of failure that contradicts the entire DePIN philosophy.

**With Hedera Schedule Service**, the reward engine runs entirely on-chain. The smart contract schedules its own future execution, verifies proofs via multi-sig, and distributes tokens — all without a single off-chain server.

---

## Dual Proof System

Azimuth uses **two cryptographic proof mechanisms**, each backed by a different HSS scheduling pattern:

| | Proof of Availability (PoA) | Proof of Reception (PoRx) |
|---|---|---|
| **What it proves** | Station is online and ready to receive | Station actually received satellite data |
| **Trigger** | Automatic, every 6 hours | On satellite pass, when proofs submitted |
| **Requirement** | Station sent heartbeats during epoch | Station received packets + verified by another station |
| **HSS Pattern** | `scheduleCallWithPayer` (time-based, self-running loop) | `scheduleCall` + `signSchedule` (multi-sig verification) |
| **Payout** | Immediate on epoch settlement | After cross-verification (or expires in 48h) |
| **Amount** | 2.0 AZM per epoch (base rate) | Variable: 1.0-2.0 AZM per unique packet contributed |
| **Purpose** | Incentivize 24/7 availability | Incentivize actual data reception quality |

```
┌─────────────────────────────────────────────────────────────────┐
│                    DUAL PROOF SYSTEM                             │
│                                                                 │
│  ┌───────────────────────────┐  ┌─────────────────────────────┐ │
│  │  PROOF OF AVAILABILITY    │  │  PROOF OF RECEPTION         │ │
│  │  (PoA)                    │  │  (PoRx)                     │ │
│  │                           │  │                             │ │
│  │  WHY: Stay online         │  │  WHY: Receive real data     │ │
│  │  WHEN: Every 6 hours      │  │  WHEN: After satellite pass │ │
│  │  HOW: Automatic (HSS      │  │  HOW: Multi-sig verified    │ │
│  │       self-running loop)  │  │       (claim + verify)      │ │
│  │  AMOUNT: Small, steady    │  │  AMOUNT: Larger, variable   │ │
│  │  REQUIRES: Heartbeat      │  │  REQUIRES: Reception proof  │ │
│  │           only            │  │           + cross-verify    │ │
│  │                           │  │                             │ │
│  │  HSS: scheduleCall-       │  │  HSS: scheduleCall +        │ │
│  │       WithPayer            │  │       signSchedule          │ │
│  │  (time-based)             │  │  (signature-based)          │ │
│  └───────────────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core HSS Functions Used

| HSS Function | Azimuth Usage |
|---|---|
| `scheduleCallWithPayer` | PoA epoch loop (self-call every 6h) + Stake unlock (7-day cooldown) |
| `scheduleCall` | PoRx reward payouts that execute when verification signatures collected |
| `signSchedule` | Stations sign to verify each other's reception proofs (PoRx) |
| `authorizeSchedule` | Approve PoRx reward claims |
| `hasScheduleCapacity` | Check network capacity before scheduling, apply backoff if congested |
| `deleteSchedule` | Cancel unstake requests or disputed PoRx reward claims |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    HEDERA NETWORK (ON-CHAIN)                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              OrbitalVault.sol (Core Contract)            │    │
│  │                                                          │    │
│  │  ┌─────────────────────────────────────────────────┐     │    │
│  │  │ PROOF OF AVAILABILITY (PoA)                     │     │    │
│  │  │                                                 │     │    │
│  │  │ Epoch Loop ──▶ HSS: scheduleCallWithPayer       │     │    │
│  │  │ (self-running)  (schedule next epoch at +6h)    │     │    │
│  │  │                                                 │     │    │
│  │  │ Each epoch:                                     │     │    │
│  │  │   Check heartbeats → pay available stations     │     │    │
│  │  └─────────────────────────────────────────────────┘     │    │
│  │                                                          │    │
│  │  ┌─────────────────────────────────────────────────┐     │    │
│  │  │ PROOF OF RECEPTION (PoRx)                       │     │    │
│  │  │                                                 │     │    │
│  │  │ On proof submission ──▶ HSS: scheduleCall       │     │    │
│  │  │ (event-driven)          (pending until verified)│     │    │
│  │  │                                                 │     │    │
│  │  │ Verification:                                   │     │    │
│  │  │   Station claims → verifier signs → auto-payout │     │    │
│  │  └─────────────────────────────────────────────────┘     │    │
│  │                                                          │    │
│  │  ┌─────────────────────────────────────────────────┐     │    │
│  │  │ Stake Manager                                   │     │    │
│  │  │                                                 │     │    │
│  │  │ Unstake ──▶ HSS: scheduleCallWithPayer          │     │    │
│  │  │              (execute unlock after 7 days)      │     │    │
│  │  └─────────────────────────────────────────────────┘     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────┐  ┌────────────────┐  ┌────────────────────┐     │
│  │ HTS: AZM   │  │ HCS: PoA +    │  │ HSS @ 0x16b       │     │
│  │ Token      │  │ PoRx Proofs   │  │ Schedule Service   │     │
│  └────────────┘  └────────────────┘  └────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
    ┌────┴────┐         ┌────┴────┐          ┌────┴────┐
    │ Station │         │ Station │          │ Station │
    │ Node A  │         │ Node B  │          │ Node C  │
    │ (Pi+RX) │         │ (Pi+RX) │          │ (Pi+RX) │
    └─────────┘         └─────────┘          └─────────┘
```

---

## Proof of Availability — PoA (Self-Running Epoch Loop)

### What It Proves

That a ground station is **online, powered on, and ready to receive satellite signals** — even when no satellite is currently overhead. PoA is the baseline proof that keeps the network healthy.

### How Heartbeats Work

Each station's Pi sends a lightweight "I'm alive" transaction to the contract periodically (e.g., every 30 minutes). The contract records the last heartbeat timestamp for each station.

```
Station A Pi:  heartbeat() → contract records: stationA.lastSeen = now
Station B Pi:  heartbeat() → contract records: stationB.lastSeen = now

(30 min later)

Station A Pi:  heartbeat() → stationA.lastSeen = now
Station B Pi:  heartbeat() → stationB.lastSeen = now
(Station C is offline — no heartbeat)
```

### PoA Epoch Settlement Flow

```
┌─────────────────────────────────────────────────────────────┐
│ PoA EPOCH LOOP — Fully Autonomous On-Chain Execution        │
│                                                             │
│ Epoch #1 executes (triggered by HSS at scheduled time)      │
│   │                                                         │
│   ├─ 1. Check heartbeats from last 6 hours                 │
│   │     Station A: 12 heartbeats → AVAILABLE ✓              │
│   │     Station B: 11 heartbeats → AVAILABLE ✓              │
│   │     Station C: 0 heartbeats  → UNAVAILABLE ✗            │
│   │                                                         │
│   ├─ 2. Distribute PoA rewards (immediate, no multi-sig)   │
│   │     Station A: +2.0 AZM (PoA)                          │
│   │     Station B: +2.0 AZM (PoA)                          │
│   │     Station C: +0.0 AZM (not available)                │
│   │                                                         │
│   ├─ 3. Check hasScheduleCapacity() for next epoch          │
│   │     ├─ Capacity OK → schedule at now + 6 hours          │
│   │     └─ Congested → apply jitter, schedule at +6h + Δ   │
│   │                                                         │
│   └─ 4. scheduleCallWithPayer(                              │
│            address: self,                                    │
│            callData: settlePoAEpoch(),                       │
│            expirySecond: now + 21600,  // 6 hours            │
│            gasLimit: 500000                                  │
│          )                                                   │
│          │                                                   │
│          ▼                                                   │
│ Epoch #2 auto-executes at expirySecond                      │
│   │                                                         │
│   ├─ 1. Check heartbeats ...                                │
│   ├─ 2. Distribute PoA rewards ...                          │
│   └─ 4. Schedule Epoch #3 ...                               │
│          │                                                   │
│          ▼                                                   │
│ Epoch #3 auto-executes ...                                  │
│   └── ... (perpetual loop, runs forever)                    │
└─────────────────────────────────────────────────────────────┘
```

### Key Properties

- **Fully automatic**: You call `initializePoAEpoch()` ONCE. The contract runs itself after that.
- **No verification needed**: Heartbeats are on-chain transactions — the contract can directly verify timestamps. No multi-sig required.
- **Immediate payout**: Available stations get paid during epoch settlement. No claim step.
- **Unavailable stations get nothing**: Missed heartbeats = missed PoA rewards. Simple.
- **Capacity-aware**: Uses `hasScheduleCapacity()` with jitter to avoid network congestion.

### Capacity-Aware Scheduling

```solidity
function scheduleNextPoAEpoch() internal {
    uint256 nextTime = block.timestamp + POA_EPOCH_INTERVAL; // 6 hours

    // Check if network can handle a schedule at that time
    bool hasCapacity = HSS.hasScheduleCapacity(nextTime);

    if (!hasCapacity) {
        // Apply jitter: random offset 0-300 seconds
        uint256 jitter = uint256(keccak256(abi.encodePacked(
            block.timestamp, poaEpochCount
        ))) % 300;
        nextTime += jitter;
    }

    // Schedule self-call
    HSS.scheduleCallWithPayer(
        address(this),                              // target = self
        abi.encodeCall(this.settlePoAEpoch, ()),    // function to call
        nextTime,                                    // when to execute
        POA_SETTLE_GAS_LIMIT                         // gas limit
    );

    emit PoAEpochScheduled(poaEpochCount + 1, nextTime);
}
```

### Example Timeline

```
08:00  PoA Epoch #1 → A: +2 AZM, B: +2 AZM, C: offline → schedules #2
14:00  PoA Epoch #2 → A: +2 AZM, B: +2 AZM, C: +2 AZM (came online) → schedules #3
20:00  PoA Epoch #3 → A: +2 AZM, B: offline, C: +2 AZM → schedules #4
02:00  PoA Epoch #4 → A: +2 AZM, B: +2 AZM, C: +2 AZM → schedules #5
...
Day 30: Station A has earned 240 AZM just for being available
```

---

## Proof of Reception — PoRx (Multi-Sig Verification)

### What It Proves

That a ground station **actually received real satellite data** during a pass — not just that it was online, but that it captured packets and can prove it with cryptographic hashes. PoRx requires cross-verification from another station to prevent fake proofs.

### How PoRx Proofs Work

After a satellite pass, each station submits a reception proof on-chain:

```
Station A submits PoRx:
  submitPoRx(
    passId: "PASS-2026-02-14-0830",
    packetIds: [0, 1, 2, 3, 5, 7, 8, 9, 10],    // which packets received
    packetHashes: [sha256(pkt0), sha256(pkt1), ...],  // proof of actual data
    totalPackets: 12,
    avgRssi: -95,
    avgSnr: 7
  )

Station B submits PoRx:
  submitPoRx(
    passId: "PASS-2026-02-14-0830",
    packetIds: [0, 1, 3, 4, 6, 7, 9, 10, 11],
    packetHashes: [sha256(pkt0), sha256(pkt1), ...],
    totalPackets: 12,
    avgRssi: -102,
    avgSnr: 4
  )
```

### PoRx Reward Calculation

The contract calculates each station's contribution to the merged image:

```
Station A: 9 packets received
  - 3 unique (only A had them: pkts 2, 5, 8)     → 3 × 1.5 AZM = 4.5 AZM
  - 6 shared (both had them)                       → 6 × 1.0 AZM = 6.0 AZM
  Total: 10.5 AZM

Station B: 9 packets received
  - 3 unique (only B had them: pkts 4, 6, 11)     → 3 × 1.5 AZM = 4.5 AZM
  - 3 gap-fillers (filled A's missing packets)     → 3 × 2.0 AZM = 6.0 AZM
  - 3 shared                                       → 3 × 1.0 AZM = 3.0 AZM
  Total: 13.5 AZM

Merged image: 12/12 packets = 100% PERFECT → Bonus: +5.0 AZM split
```

### PoRx Verification Flow (Multi-Sig via HSS)

```
┌─────────────────────────────────────────────────────────────┐
│ PoRx REWARD — Multi-Sig Verification via HSS                │
│                                                             │
│ After satellite pass, contract calculates PoRx rewards:     │
│   Station A → 10.5 AZM (9 packets, 3 unique)               │
│   Station B → 13.5 AZM (9 packets, 3 gap-fillers)          │
│                                                             │
│ Step 1: Contract creates scheduled PoRx reward for A        │
│   scheduleCall(                                             │
│     target: AZM_TOKEN,                                      │
│     callData: transfer(stationA, 10.5 AZM),                │
│     expirySecond: now + 48 hours,                           │
│     gasLimit: 100000                                        │
│   ) → returns scheduleAddress_A                             │
│   Required signatures: [Station A, any other participant]   │
│                                                             │
│ Step 2: Contract creates scheduled PoRx reward for B        │
│   scheduleCall(...) → returns scheduleAddress_B             │
│   Required signatures: [Station B, any other participant]   │
│                                                             │
│ Step 3: Station A claims its PoRx reward                    │
│   signSchedule(scheduleAddress_A)                           │
│   Status: ◉ PENDING (1/2 signatures)                       │
│           [Station A ✓] [Verifier ○]                        │
│                                                             │
│ Step 4: Station B verifies Station A's PoRx                 │
│   "I was also listening — Station A's packet hashes match   │
│    the data I received. Their proof is legitimate."         │
│   signSchedule(scheduleAddress_A)                           │
│   All signatures collected!                                  │
│   ═══════════════════════════════════════════                │
│   ║ HSS AUTO-EXECUTES: 10.5 AZM → Station A ║             │
│   ═══════════════════════════════════════════                │
│                                                             │
│ Step 5: Station A verifies Station B's PoRx (reciprocal)    │
│   signSchedule(scheduleAddress_B)                           │
│   All signatures collected!                                  │
│   → 13.5 AZM → Station B                                   │
│                                                             │
│ EDGE CASES:                                                 │
│                                                             │
│ No verification within 48 hours:                            │
│   → Schedule expires → tokens return to reward pool         │
│   → Station flagged for review                              │
│                                                             │
│ Station A submits fake PoRx:                                │
│   → Station B sees packet hashes don't match                │
│   → Station B refuses to sign                               │
│   → Schedule expires → Station A gets nothing               │
│   → Repeated fakes → DAO calls slash(stationA)              │
└─────────────────────────────────────────────────────────────┘
```

### Why Multi-Sig Makes Sense for PoRx

PoA rewards don't need verification — heartbeats are on-chain, timestamps are provable. But PoRx is different:

- A station could claim "I received 50 packets" but actually received 0
- The contract can't verify packet data by itself — it doesn't have the satellite signal
- **Only another station that was also listening can confirm the data is real**
- By comparing `packetHashes`, stations can verify each other's PoRx claims without trusting anyone

---

## How PoA and PoRx Work Together

```
Timeline of a typical day:

02:00  ┌─ PoA EPOCH #1 settles (auto, HSS)
       │  Station A: available ✓ → +2.0 AZM (PoA)
       │  Station B: available ✓ → +2.0 AZM (PoA)
       └─ Schedules Epoch #2 at 08:00

05:30  ┌─ SATELLITE PASS occurs
       │  Station A receives 9/12 packets → submits PoRx
       │  Station B receives 9/12 packets → submits PoRx
       │  Contract creates PoRx rewards:
       │    Station A: 10.5 AZM (scheduled, needs verification)
       │    Station B: 13.5 AZM (scheduled, needs verification)
       └─ Status: ◉ PENDING verification

06:00  ┌─ PoRx VERIFICATION
       │  Station A signs Station B's PoRx → B gets 13.5 AZM ✓
       │  Station B signs Station A's PoRx → A gets 10.5 AZM ✓
       └─ Both PoRx rewards EXECUTED

08:00  ┌─ PoA EPOCH #2 settles (auto, HSS)
       │  Station A: available ✓ → +2.0 AZM (PoA)
       │  Station B: available ✓ → +2.0 AZM (PoA)
       └─ Schedules Epoch #3 at 14:00

14:00  ┌─ PoA EPOCH #3 settles (auto, HSS)
       │  Station A: available ✓ → +2.0 AZM (PoA)
       │  Station B: offline ✗  → +0.0 AZM
       └─ Schedules Epoch #4 at 20:00

       (no satellite pass — no PoRx rewards this cycle)

20:00  ┌─ PoA EPOCH #4 settles ...
       └─ ...

Daily earnings for Station A:
  PoA:   4 epochs × 2.0 AZM = 8.0 AZM  (availability)
  PoRx:  1 pass × 10.5 AZM  = 10.5 AZM (data capture)
  Total:                       18.5 AZM
```

### Revenue Split

```
┌──────────────────────────────────────────────┐
│ Station A — Daily Revenue                     │
│                                              │
│ ████████░░░░░░░░░░░░░░ 43% PoA   (8.0 AZM)  │
│ ████████████████████░░ 57% PoRx  (10.5 AZM)  │
│                                              │
│ PoA is the baseline — you earn just for      │
│ being online and ready.                      │
│                                              │
│ PoRx is the bonus — you earn more for        │
│ actually capturing real satellite data.      │
└──────────────────────────────────────────────┘
```

---

## Flow 3: Scheduled Stake Unlock

Station operators stake AZM tokens to activate their station. When they want to leave, HSS handles a trustless cooldown period.

```
┌─────────────────────────────────────────────────────────────┐
│ STAKE UNLOCK — Time-Based Scheduled Execution               │
│                                                             │
│ Day 0: Operator calls requestUnstake()                      │
│   │                                                         │
│   ├─ Contract marks station as "DEACTIVATING"               │
│   ├─ Station stops earning PoA + PoRx rewards               │
│   └─ Contract schedules token return:                       │
│        scheduleCallWithPayer(                                │
│          target: AZM_TOKEN,                                  │
│          callData: transfer(operator, stakedAmount),         │
│          expirySecond: now + 7 days,                        │
│          gasLimit: 100000                                    │
│        )                                                     │
│                                                             │
│ Day 1-6: Cooldown period                                    │
│   │                                                         │
│   ├─ Operator can cancelUnstake() → deleteSchedule()        │
│   │   Station reactivates, resumes earning PoA + PoRx       │
│   │                                                         │
│   └─ If operator misbehaved during cooldown:                │
│       slash() → deleteSchedule() → reduce stake → reschedule│
│                                                             │
│ Day 7: expirySecond reached                                 │
│   ══════════════════════════════════════════                 │
│   ║ HEDERA AUTO-EXECUTES: staked AZM → operator wallet ║   │
│   ══════════════════════════════════════════                 │
│   Station fully deregistered                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Schedule Lifecycle on Dashboard

The dashboard shows the full lifecycle of every scheduled action — a bounty requirement.

```
┌─────────────────────────────────────────────────────────────┐
│ [ SCHEDULE TRACKER ]                                         │
│                                                             │
│ ┌─ PoA EPOCH #47 ────────────────────────────────────────┐ │
│ │ Type:      PROOF OF AVAILABILITY (PoA)                  │ │
│ │ Status:    ✓ EXECUTED                                   │ │
│ │ Created:   2026-02-14 08:00:00  TX: 0x3fa8...c1b ↗     │ │
│ │ Executed:  2026-02-14 08:00:02  TX: 0xa2c1...f8e ↗     │ │
│ │ Paid:      2 available stations, 4.0 AZM total         │ │
│ │ Next:      PoA Epoch #48 at 14:00:00                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ PoRx: Station A (Pass 2026-02-14-0830) ───────────────┐ │
│ │ Type:      PROOF OF RECEPTION (PoRx)                     │ │
│ │ Status:    ◉ PENDING — awaiting verifier signature      │ │
│ │ Created:   2026-02-14 08:35:00  TX: 0xb1d2...4a7 ↗     │ │
│ │ Claimed:   2026-02-14 08:36:15  (Station A signed)     │ │
│ │ Expires:   2026-02-16 08:35:00  (47h remaining)        │ │
│ │ Amount:    10.5 AZM                                     │ │
│ │ Sigs:      1/2 [Station A ✓] [Verifier ○]              │ │
│ │ Packets:   9/12 (3 unique, 6 shared)                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ PoRx: Station B (Pass 2026-02-14-0830) ───────────────┐ │
│ │ Type:      PROOF OF RECEPTION (PoRx)                     │ │
│ │ Status:    ✓ EXECUTED                                   │ │
│ │ Created:   2026-02-14 08:35:00  TX: 0xc3e4...9f2 ↗     │ │
│ │ Verified:  2026-02-14 08:37:22  (Station A verified)   │ │
│ │ Executed:  2026-02-14 08:37:22  TX: 0xd4f5...3b1 ↗     │ │
│ │ Amount:    13.5 AZM                                     │ │
│ │ Packets:   9/12 (3 unique, 3 gap-fill, 3 shared)       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ STAKE UNLOCK: Operator 0x7c2... ───────────────────────┐ │
│ │ Status:    ⏳ SCHEDULED — executes in 5d 12h            │ │
│ │ Created:   2026-02-12 10:00:00  TX: 0xe5a6...7c2 ↗     │ │
│ │ Executes:  2026-02-19 10:00:00                          │ │
│ │ Amount:    100 AZM (full stake return)                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Status Legend:                                               │
│   ✓ EXECUTED   ◉ PENDING   ⏳ SCHEDULED   ✗ EXPIRED/FAILED │
└─────────────────────────────────────────────────────────────┘
```

---

## Smart Contract: OrbitalVault.sol — Key Functions

```solidity
// ─── PROOF OF AVAILABILITY (PoA) ─────────────────────────
function initializePoAEpoch()           // Start the self-running loop (call ONCE)
function settlePoAEpoch()               // Called by HSS every 6 hours
function heartbeat()                    // Stations call this to prove availability
function getPoAStatus(address)          // Check a station's heartbeat history

// ─── PROOF OF RECEPTION (PoRx) ───────────────────────────
function submitPoRx(                    // Station submits proof after satellite pass
    bytes32 passId,
    uint16[] packetIds,
    bytes32[] packetHashes,
    uint16 totalPackets,
    int16 avgRssi,
    int16 avgSnr
)
function claimPoRxReward(bytes32 passId)                     // Station signs its PoRx reward schedule
function verifyPoRx(address station, bytes32 passId)         // Cross-verify another station's PoRx
function getPoRxStatus(address, bytes32)                     // Check PoRx reward lifecycle

// ─── STAKING ──────────────────────────────────────────────
function registerStation(string location)       // Stake AZM + activate station
function requestUnstake()                       // Start 7-day cooldown via HSS
function cancelUnstake()                        // Cancel → deleteSchedule → reactivate
function slash(address station, string reason)  // Penalize bad actor

// ─── SCHEDULE TRACKING ───────────────────────────────────
function getActiveSchedules()                    // All pending schedules (PoA + PoRx + stakes)
function getScheduleDetails(address scheduleAddr)  // Status + lifecycle
function getScheduleHistory(uint256 limit)       // Past executed/expired schedules
```

---

## Edge Cases & Failure Handling

| Edge Case | Handling |
|---|---|
| **Reward pool empty** | `settlePoAEpoch()` detects zero balance → skips PoA rewards → emits `RewardPoolDepleted` → schedules next epoch normally |
| **No heartbeats received** | `settlePoAEpoch()` finds no available stations → no PoA rewards → schedules next epoch → emits `NoActiveStations` |
| **No PoRx proofs submitted** | No PoRx rewards created → PoA rewards still run independently on their own schedule |
| **Only 1 station captured data** | No cross-verification possible → single-station PoRx accepted after 48h expiry (reduced reward, 0.5x multiplier) |
| **PoRx reward expires (no verification)** | Tokens return to pool → station loses PoRx reward but keeps PoA reward → flagged for monitoring |
| **Network congestion** | `hasScheduleCapacity()` returns false → exponential backoff with jitter → retry at offset time |
| **Station goes offline mid-epoch** | Misses remaining heartbeats → receives partial PoA reward proportional to active time |
| **Fake PoRx proof** | Honest stations refuse to `signSchedule` → PoRx reward expires → repeated fakes → `slash()` by DAO |
| **Insufficient gas for PoA epoch** | HSS reverts → `retryPoASettlement()` available for manual recovery → loop resumes |

---

## Bounty Checklist Alignment

| Bounty Requirement | Azimuth Implementation | Status |
|---|---|---|
| Working app on Hedera Testnet | OrbitalVault + Pi station + dashboard | Required |
| Scheduling from smart contract | PoA epoch loop + PoRx reward schedules via HSS | ✓ |
| Not only from backend script | All scheduling is contract-driven. Pi only sends heartbeats and PoRx proofs. | ✓ |
| Public repo | GitHub: azimuth-depin | Required |
| Live demo or runnable CLI | Pi dashboard + web UI, Docker for contracts | Required |
| <3 min demo video | Satellite TX → dual-node RX → PoA epoch → PoRx reward → verify → lifecycle | Required |
| Schedule lifecycle UI | created → pending → executed/failed with TX links | ✓ |
| Innovation | DePIN + satellite + dual-proof (PoA/PoRx) HSS = unique | ✓ |
| Feasibility | Real hardware, real LoRa, real Hedera TXs | ✓ |
| Integration | HTS (token) + HCS (proofs) + HSS (automation) + EVM contracts | ✓ |
| Edge cases handled | Pool empty, expiry, congestion, single-station fallback, slashing | ✓ |
| Observability | Dual-proof schedule tracker + history + TX links | ✓ |

---

## Demo Flow (3-Minute Video Script)

```
0:00 - 0:15  "Azimuth: a DePIN satellite ground station network,
              fully automated with Hedera Schedule Service."
             Show hardware on table

0:15 - 0:35  "Proof of Availability — stations earn rewards for being online."
             Show dashboard: PoA Epoch settling...
             2 stations available → 2.0 AZM each → EXECUTED ✓
             "This runs every 6 hours — no server, pure on-chain."

0:35 - 1:00  "Proof of Reception — stations earn more for capturing real data."
             Press PRG on transmitter
             Dashboard: packets arriving on Node A and Node B
             Merge map fills in — green from A, cyan from B
             Complete image assembled

1:00 - 1:30  "PoRx rewards require cross-verification. No central authority."
             Contract creates scheduled PoRx payouts: PENDING
             Station A claims → Station B verifies → EXECUTED ✓
             Show: 10.5 AZM → A, 13.5 AZM → B
             Hedera TX links on dashboard

1:30 - 2:00  "Two proof mechanisms. PoA for availability. PoRx for real work."
             Show schedule tracker: PoA epochs auto-running
             Show PoRx rewards alongside — different lifecycle
             Show next PoA epoch: SCHEDULED, executes in 6 hours

2:00 - 2:30  "Staking, unstaking, slashing — all scheduled on-chain."
             Show stake unlock: SCHEDULED, 7-day cooldown
             Show cancel option → deleteSchedule
             Show edge case: expired PoRx → clean failure

2:30 - 3:00  "Azimuth: decentralized satellite infrastructure,
              powered by Proof of Availability, Proof of Reception,
              and Hedera Schedule Service."
             Show full schedule history scrolling
             Flash total AZM earned
```

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Satellite Simulator | ESP32 (Heltec WiFi LoRa 32 V4) |
| Ground Station Receivers | ESP32 (Heltec) → USB → Raspberry Pi 5 |
| LoRa Radio | SX1262, 915 MHz, RadioLib |
| Station Dashboard | Python, Pygame (sci-fi theme) |
| Smart Contracts | Solidity, Hedera EVM, HSS @ 0x16b |
| Token | AZIMUTH (AZM) via Hedera Token Service |
| PoA + PoRx Proof Logging | Hedera Consensus Service (HCS) |
| Reward Scheduling | Hedera Schedule Service (HSS) |
| Image Storage | IPFS (Pinata / web3.storage) |
| Web Dashboard | Next.js, Hedera Mirror Node API |
| Development | Hardhat, @hashgraph/sdk, ethers.js |
| Testnet | Hedera Testnet (portal.hedera.com) |
