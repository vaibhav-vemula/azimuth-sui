# @azimuth/memwal-depin

**Give DePIN sensor agents verifiable, shareable long-term memory on Walrus — in ~10 lines.**

DePIN networks generate streams of real-world readings (RF captures, air quality, energy, GPS…).
This adapter standardizes recording those observations as **MemWal (Walrus Memory)** entries so
agents can recall them across sessions, share them across nodes, and prove they weren't tampered
with — the exact problem the Sui Overflow Walrus track targets ("Walrus as a Verifiable Data
Platform for AI").

Built for [Azimuth](../../README.md), but **framework- and project-agnostic**.

## Install

```bash
npm install @azimuth/memwal-depin
npm install @mysten-incubation/memwal --legacy-peer-deps   # peer dep (Seal pulls @mysten/sui v2)
```

## Quick start (MemWal-backed)

```js
import { createMemwalSensorRecorder } from "@azimuth/memwal-depin";

const sensors = await createMemwalSensorRecorder(
  { key: process.env.MEMWAL_KEY, accountId: process.env.MEMWAL_ACCOUNT_ID, serverUrl: process.env.MEMWAL_SERVER_URL, namespace: "my-depin-net" },
  { source: "my-depin-net" }
);

// Store an observation as verifiable memory:
await sensors.record({
  sensorId: "node-42",
  type: "air-quality",
  value: 38,
  unit: "AQI",
  geo: { lat: 40.71, lon: -74.0 },
  note: "evening spike near highway",
});

// Recall it later (semantic), optionally per-sensor:
const hits = await sensors.recall("air quality spikes near highways", { k: 5 });
```

## Bring your own backend

`createSensorRecorder` works with **any** store exposing `remember(text, metadata)` +
`recall(query, k)` — MemWal, a local JSON store, a vector DB, etc.:

```js
import { createSensorRecorder } from "@azimuth/memwal-depin";
const sensors = createSensorRecorder(myMemory, { source: "my-net" });
```

## API

- `createSensorRecorder(memory, { source })` → `{ record, recordArtifact, recall, backend }`
- `memwalBackend({ key, accountId, serverUrl, namespace })` → a MemWal-backed `{ remember, recall }`
- `createMemwalSensorRecorder(config, opts)` → MemWal-backed recorder in one call
- `observationText(obs)` → the canonical, recall-friendly sentence
- `OBSERVATION_SCHEMA` → the standardized observation shape

`record(observation)` stores a stable sentence for semantic recall **and** round-trips the
structured fields as metadata, so reads return both. `recordArtifact(...)` references Walrus blobs
(images, reports, datasets) derived from sensor data.

## Why verifiable

MemWal persists memory on **Walrus** (content-addressed, erasure-coded) with ownership/access on
**Sui** — so memory is durable even if a node goes offline, portable across models/vendors, and
**tamper-evident**: a node can't silently rewrite its own history. See `agents/verify.mjs` in the
Azimuth repo for an independent re-verification of a stored memory blob.
