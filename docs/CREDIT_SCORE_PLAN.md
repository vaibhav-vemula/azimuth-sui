# Credit Score & Multiplier System — Implementation Plan

---

## Current State

The contract has `heartbeatCount`, `totalPoaRewards`, `totalPorxRewards` on the `Station` struct — but no credit score, no multiplier. Every station earns a flat `poaRewardAmount` regardless of history.

---

## What Needs to Change

### 1. Contract — `OrbitalVault.sol`

**Add to `Station` struct:**
```solidity
uint256 creditScore;      // cumulative trust score
uint256 epochsQualified;  // total PoA epochs passed
uint256 totalReceptions;  // total verified PoRx events
```

**Add configurable score constants:**
```solidity
uint256 public scorePerPoaEpoch = 10;  // points per qualified epoch
uint256 public scorePerPorx = 5;       // points per verified reception
```

**Add `getMultiplier()` pure view:**
```solidity
function getMultiplier(address _station) public view returns (uint256) {
    uint256 score = stations[_station].creditScore;
    if (score >= 700) return 200; // Platinum — 2.0x
    if (score >= 500) return 150; // Gold     — 1.5x
    if (score >= 300) return 125; // Silver   — 1.25x
    return 100;                   // Bronze   — 1.0x
}
```

> Multiplier stored as basis points: 100 = 1x, 125 = 1.25x, etc. No floats in Solidity.

**Modify `settlePoAEpoch()`** — when a station qualifies, before paying:
```solidity
s.creditScore += scorePerPoaEpoch;
s.epochsQualified++;
uint256 multiplier = getMultiplier(addr);
uint256 reward = poaRewardAmount * multiplier / 100;
// transfer `reward` instead of flat `poaRewardAmount`
```

**Modify `executePoRxPayout()`** — after successful transfer:
```solidity
stations[_station].creditScore += scorePerPorx;
stations[_station].totalReceptions++;
```

**Modify `slash()`** — score penalty on bad behaviour:
```solidity
s.creditScore = s.creditScore > 300 ? s.creditScore - 300 : 0;
```

**Add event:**
```solidity
event CreditScoreUpdated(address indexed station, uint256 newScore, string reason);
```

**Extend `getStationInfo()`** to return `creditScore`, `epochsQualified`, `totalReceptions`, and current `multiplier`.

---

### 2. Score Progression Example

| Activity | Points | Running total |
|----------|--------|---------------|
| Qualified PoA epoch | +10 | 15 epochs = 150 pts |
| Verified PoRx | +5 | 10 receptions = 50 pts |
| Slash event | −300 | — |
| **After ~2 weeks** | | **~200 pts → Bronze (1.0x)** |
| **After ~1 month** | | **~350 pts → Silver (1.25x)** |

---

### 3. Dashboard — `StationStatus` component

- Show credit score number + tier badge (Bronze / Silver / Gold / Platinum)
- Show current multiplier (e.g. "1.25x")
- Show `epochsQualified` and `totalReceptions`
- Progress bar toward next tier threshold

---

### 4. Hedera Client — `stateTracker.js`

- After each epoch settlement, read and log the new `creditScore` and `multiplier` for each station
- After each PoRx payout, log the score increase

---

## Tier Summary

| Tier | Score | Multiplier | How to reach |
|------|-------|-----------|--------------|
| Bronze | 0–299 | 1.0x | Default — all new stations start here |
| Silver | 300–499 | 1.25x | ~22 qualified epochs + 10 receptions |
| Gold | 500–699 | 1.5x | ~42 qualified epochs + 15 receptions |
| Platinum | 700+ | 2.0x | ~60 qualified epochs + 20 receptions |

---

## Rules

- Score is **cumulative and only increases** through honest participation
- Slash events **deduct 300 points** — a meaningful but recoverable penalty
- Score is stored on-chain in the `Station` struct — fully transparent and queryable
- Multiplier is computed as a pure view function — no additional storage needed
- Multiplier applies to **PoA rewards only** in v1 — PoRx base reward stays flat
