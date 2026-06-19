# Azimuth × Hedera — Presentation Script

---

## SLIDE 1 — Title

> "Right now, a satellite is passing over us. It's transmitting data — images, sensor readings, environmental signals. And almost all of it is being lost.
>
> Not because the technology doesn't exist to receive it. But because the infrastructure to receive it is locked behind corporations and hundred-thousand dollar entry barriers.
>
> I built Azimuth to change that. Azimuth is a decentralized satellite ground station network — where anyone can become infrastructure, get paid for real-world signal reception, and build a verifiable financial identity on Hedera."

---

## SLIDE 2 — Problem

> "The satellite data market is worth billions. Weather forecasting, agriculture, disaster response, environmental monitoring — all of it depends on ground stations being able to receive satellite transmissions.
>
> But today's ground station infrastructure has three fatal flaws. It's **centralized** — a handful of corporations decide who gets access and can revoke it at any time. It's **expensive** — I'm talking AWS bills and $100,000 ground station builds just to get started. And it's **fragile** — one station, one point of failure, incomplete coverage.
>
> Independent operators who could run ground stations have no reason to. There's no payment, no protocol, no proof that their work happened."

---

## SLIDE 3 — Bottlenecks

> "Let's be specific about what's broken.
>
> **Corporate gatekeeping** — the companies that control satellite data streams can delete, restrict, or sell access to whoever they choose. There's no transparency.
>
> **Prohibitive costs** — a university research team, a startup, an NGO doing pollution monitoring — none of them can afford $100k hardware. Cloud alternatives like AWS are cheaper but still centralized and expensive at scale.
>
> **Data loss** — a single ground station only catches a fraction of packets as a satellite passes overhead. You get a partial image, partial data, gaps you can't fill.
>
> **No incentives** — and because there's no payment model, there's no reason for anyone to set up a ground station unless they're already a large institution. The network never grows.
>
> These four problems compound each other. Azimuth solves all four simultaneously."

---

## SLIDE 4 — Solution

> "Azimuth is ground station infrastructure as a protocol.
>
> Here's what that means in one sentence: anyone with an Azimuth DePIN device can run a ground station, receive real satellite transmissions, submit cryptographic proof of that reception on **Hedera**, and earn **AZM token** rewards — automatically.
>
> Every single reception is permanently anchored on Hedera. Not stored on a server. Not in a database anyone can shut down. On-chain. Forever.
>
> The key insight is that Hedera isn't just where I deployed — it's the coordination layer, the settlement layer, and the credit history layer. The chain *is* the protocol."

---

## SLIDE 5 — Use Cases

> "And look at who needs this.
>
> Weather services that need real-time atmospheric data. Research teams that can't afford enterprise contracts. Universities running space science programs. Startups building precision agriculture tools. NGOs doing environmental monitoring. Disaster response teams that need infrastructure that stays online when everything else fails.
>
> Every single one of these groups is currently priced out or blocked by the centralized model.
>
> And here's the beautiful part — an Azimuth ground station costs **eighty-five dollars**. A Heltec ESP32 LoRa receiver for twenty-five dollars and a Raspberry Pi. That's it. Azimuth makes this hardware economically productive by connecting it to Hedera's financial infrastructure."

---

## SLIDE 6 — The Operator Journey

> "Let me walk you through exactly how it works — from zero to earning rewards.
>
> **Step one: Stake and register.** The operator stakes AZM tokens and calls `registerStation()` on Hedera. Real economic skin in the game. If you behave badly, your stake gets slashed and burned permanently — an irreversible on-chain consequence.
>
> **Step two: Go online.** The station starts sending a heartbeat transaction to the `OrbitalVault` contract every sixty seconds. Every heartbeat is proof the station is online. This builds your Proof of Availability record.
>
> **Step three: Receive passes.** When a satellite passes overhead, the station captures LoRa packets over RF. Raw packet data goes to Arweave — permanent, content-addressed storage. The station then publishes its announcement to a Hedera HCS topic.
>
> **Step four: Multi-station merge.** Here's where it gets interesting. No direct contact between stations ever occurs. Both stations post to the same HCS topic on Hedera. The primary station polls the Mirror Node, detects both announcements, fetches both Arweave datasets, merges the packets, and reconstructs the best possible image. Hedera is the coordination layer.
>
> **Step five: Submit proof.** The station computes a Merkle root of all received packet hashes and submits it on-chain. A peer station cross-verifies. AZM is paid automatically by the contract via Hedera Schedule Service.
>
> **Step six: Credit grows.** Every settlement is recorded in `OrbitalVault`. Bronze to Silver to Gold to Platinum. And your reward multiplier rises with it — up to two times."

---

## SLIDE 7 — Operator Rewards

> "There are two reward streams.
>
> **Proof of Availability** — you get paid for being online. Every epoch, stations that met the heartbeat threshold share the PoA reward pool. Your cut is multiplied by your credit score tier. An operator who's been online for months earns twice what a new operator earns — automatically, on-chain, with no manual configuration.
>
> What makes this possible is the **Hedera Schedule Service**. There is no off-chain keeper, no cron job, no trusted third party triggering settlements. The contract schedules its own next epoch at the end of every settlement. It runs itself.
>
> **Proof of Reception** — you get paid for actual satellite pass reception. The more packets you capture, the higher your completeness score, the higher your next credit score update. Better signal, more passes, higher rewards.
>
> Two income streams. Both growing over time as your credit score climbs."

---

## SLIDE 8 — PoA & PoRx Deep Dive

> "Let me give you the cryptographic reality of how Proof of Reception works — because this is what makes it unforgeable.
>
> The satellite transmits as 104 individual LoRa packets. Each packet the station receives gets hashed with keccak256. The station computes a Merkle root of all those hashes and submits it to `OrbitalVault` on Hedera.
>
> **You cannot fake this.** A valid Merkle root requires the actual packet bytes. You can't construct a valid root without physically receiving the RF signal. Every root is stored on Hedera permanently — no party can alter or delete it. The reception happened, or it didn't. The chain says so.
>
> And for Proof of Availability — it's elegantly simple. A heartbeat transaction every sixty seconds. The contract tracks it. If you meet the threshold, you qualify for that epoch's rewards. Hedera Schedule Service executes the settlement. No disputes, no manual review, no corporate decision-making."

---

## SLIDE 9 — Why Hedera

> "I want to be specific about why Hedera — because this wasn't a generic EVM deployment.
>
> **HCS** gave me a native, ordered message log that both stations write to independently. No server, no API, no centralised coordinator. Stations post to Hedera and the protocol handles the rest.
>
> **HSS** gave me fully autonomous epoch settlements. The contract schedules its own next call every time it settles. No keeper, no cron job. That's something most chains simply can't offer natively.
>
> **The Mirror Node** meant both dashboards are pure frontend with zero backend infrastructure. Free, unauthenticated, real-time queries over all on-chain and HCS data.
>
> Hedera wasn't convenient — it was necessary."

---

## SLIDE 10 — Demo

> "Everything I've just described — I built it. It's deployed on Hedera testnet right now. Two contracts: `OrbitalVault` and `AzimuthToken`. One HCS coordination topic.
>
> In the demo you're about to see: a physical Heltec ESP32 transmitting a JPEG as 104 LoRa packets. Two ground stations receiving different subsets of those packets. Hedera HCS coordinating the merge — with no direct contact between stations. The combined image appearing on the image archive dashboard. The Merkle root anchored on-chain. The credit score ticking up.
>
> Real hardware. Real RF signals. Real on-chain proof on Hedera.
>
> Hedera was built for exactly this — high-frequency, real-world coordination at low cost with fast finality. Azimuth puts all of that to work for the people building the satellite data infrastructure of the future.
>
> Thank you."

---

## Timing Guide

| Slide | Target Time |
|---|---|
| Title | 45s |
| Problem | 60s |
| Bottlenecks | 75s |
| Solution | 60s |
| Use Cases | 60s |
| Operator Journey | 2m |
| Operator Rewards | 75s |
| PoA & PoRx Deep Dive | 75s |
| Why Hedera | 60s |
| Demo | 60s |
| **Total** | **~13 min** |

> Cut the PoA/PoRx deep dive to 45s if you need to stay under 10 minutes.
