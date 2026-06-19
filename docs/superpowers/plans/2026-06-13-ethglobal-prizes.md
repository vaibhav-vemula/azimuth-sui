# ETHGlobal New York — Azimuth Prize Strategy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Win 3 prizes totalling ~$6,500–$7,500 by making targeted additions to Azimuth's existing DePIN satellite ground station network.

---

## 1. Prize Selection — Full Continuity Track Analysis

Every continuity-only prize evaluated against what Azimuth has right now.

| Prize | Amount | Fit | Decision |
|---|---|---|---|
| Hedera HSS Automation | $1,000 (×3 teams) | 90% built | ✅ DO IT |
| Sui Walrus Storage | $3,000 (×4 teams) | Perfect migration story | ✅ DO IT |
| ENS Continuity | $2,500 + $6k split | Natural DePIN identity story | ✅ DO IT |
| World ID Track C | $1,500 | Sybil resistance use case | 🟡 STRETCH |
| Chainlink Upgrade | $1,000 (×2 teams) | Hedera has no native Chainlink | ❌ SKIP |
| Arc Continuity | $1,500 | Needs stablecoin payment flows | ❌ SKIP |
| Uniswap Stack | $1,000 (×3 teams) | No DeFi component in Azimuth | ❌ SKIP |
| 1inch Aqua | $1,500 | Needs DeFi position/SwapVM | ❌ SKIP |
| Canton Agentic Commerce | $1,500 | Needs Daml on Canton DevNet | ❌ SKIP |
| Dynamic Wallet Glow Up | $2,000 | Dashboard is read-only explorer | ❌ SKIP |
| Privy Upgrade | $1,250 | $1,250 reward for significant work | ❌ SKIP |

**Why the skips?** Each skipped prize requires either (a) a completely different tech stack you don't use, or (b) significant architectural changes for a small prize relative to effort.

**Hidden opportunity:** ENS has a second prize — "Integrate ENS" ($6,000 split evenly among all qualifying projects). If 6 teams qualify you get $1,000. This is free money layered on top of the ENS Continuity work — same code, two prize submissions.

---

## 2. What Each Prize Requires (Verbatim) vs. What You Have

---

### Prize A — Hedera HSS: $1,000 (up to 3 teams win)

**Exact requirements from the page:**
> "Use the Hedera Schedule Service to create and execute scheduled transactions on Hedera Testnet"
> "Expose a user-facing workflow to create, approve, and manage scheduled actions"
> "Execute at least one real future or conditional transaction end to end"
> "Include a ≤ 5-minute demo video"

**What Azimuth already has:**
| Requirement | Status |
|---|---|
| HSS used for epoch settlements (`settlePoAEpoch` auto-fires) | ✅ Done |
| HSS used for unstake cooldown (`requestUnstake` → 7-day HSS) | ✅ Done |
| HCS audit trail of every settlement | ✅ Done |
| `ScheduleTable` dashboard shows active HSS schedules | ✅ Done |
| User-facing workflow to **create** a scheduled action | ❌ Missing |
| 5-minute demo video | ❌ Missing |

**The one gap:** The dashboard shows schedules but can't create them. Judges need to see a user click a button that produces an HSS transaction on Hashscan.

**What to build:** A "Schedule Unstake" button in the dashboard that calls `vault.requestUnstake()` via a local bridge API. When clicked: creates an HSS scheduled transaction, returns the Hashscan link, shows the schedule in the ScheduleTable.

**Demo script (60 seconds):**
1. Open dashboard, load Station A's address
2. Click "Schedule Unstake" → show green confirmation + Hashscan link
3. Click Hashscan link → show HSS transaction in "Scheduled" state
4. Scroll to ScheduleTable → new row visible
5. Narrate: "This executes automatically in 7 days. No keeper. No cron job. Hedera HSS does it."

**Effort:** ~3 hours. This is the easiest prize to lock in.

---

### Prize B — Walrus: $3,000 (up to 4 teams win)

**Exact requirements from the page:**
> "Most market-viable products and dApps already relying on decentralized storage that choose Walrus as their storage solution"
> "The project must read from and/or write to Walrus (testnet or mainnet) as a core part of the app"
> "The project must be an existing product (not built from scratch this weekend) that is adopting Walrus during the hackathon"
> "A working demo of the Walrus integration must be submitted"
> *[Implied from context]* "We care more about depth than breadth — Walrus doing genuine work in the stack rather than a quick add-on bolted on to qualify"

**What Azimuth already has:**
| Requirement | Status |
|---|---|
| Existing product relying on decentralized storage | ✅ Uses Arweave/Irys as core infrastructure |
| Not built from scratch this weekend | ✅ Pre-existing project |
| Decentralized storage is a CORE part of app | ✅ Without Arweave, multi-station merge coordination breaks |
| Read from Walrus | ❌ Missing |
| Write to Walrus | ❌ Missing |
| Working demo | ❌ Missing |

**The prize text literally describes you:** "already relying on decentralized storage" → you use Arweave. "choosing Walrus as their storage solution" → swap Arweave for Walrus. This is the cleanest possible migration story.

**What to build:** Replace Arweave/Irys in `packetPublisher.js` and `imageMerger.js` with Walrus HTTP API. Update `image-dashboard/lib/arweave.js` to fetch images from Walrus aggregator URL. The HCS coordination messages already carry storage IDs — just change `arweaveTxId` → `walrusBlobId`.

**Walrus HTTP API (no SDK needed):**
- Upload: `PUT https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=5`
- Download: `GET https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blobId}`

**Demo script (90 seconds):**
1. Trigger a satellite pass → show terminal: `[WALRUS] Uploaded 12,847 bytes → <blobId>`
2. Open image dashboard → merged image loads from `aggregator.walrus-testnet.walrus.space`
3. Open browser DevTools → Network tab shows image fetch URL is Walrus
4. Narrate: "Every packet dataset and every merged satellite image is now stored on Walrus. Walrus is the backbone of our multi-station coordination — without it, ground stations can't share data."

**Effort:** ~6 hours. The highest-value prize relative to effort.

**Pre-flight:** Walrus testnet requires WAL tokens. Before the hackathon: go to https://docs.walrus.site/usage/setup.html, set up a Sui wallet, get testnet WAL from the faucet. Verify with:
```bash
curl -X PUT https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=1 \
  -H "Content-Type: text/plain" --data "test"
```

---

### Prize C — ENS Continuity: $2,500 (1st) / $1,500 (2nd)
### Bonus: ENS Integrate — $6,000 split (same work qualifies)

**Exact requirements from the page:**
> "Best project that meaningfully extends an existing product or open source project with ENS"
> "Add ENS where it makes the product better: identity, discovery, onboarding, payments, profiles, subnames, records, or entirely new UX"
> "It should be clear what ENS-powered feature was built during the hackathon and how it improves the existing product"
> "Demo must be functional (no hard-coded values)"
> "Submit with a video or live demo link and present at the ENS booth in person on Sunday morning"

**For the general "Integrate ENS" prize ($6k split):**
> "You need to write some code specifically for ENS. Simply using Rainbowkit does not count"
> "Your demo must be functional and not contain hard-coded values"

**What Azimuth already has:**
| Requirement | Status |
|---|---|
| Existing product | ✅ |
| On-chain operator identities with addresses | ✅ |
| Credit score system (Bronze → Platinum) | ✅ |
| Any ENS integration | ❌ None |

**The story:** Ground station operators currently have identities like `0xaa6c...cd55`. With ENS, they become `nyc-station.eth`. Their credit score, tier, and uptime are portable ENS text records — discoverable by anyone, verifiable on-chain, not tied to a private key. This is meaningful: the credit history follows the ENS name, not the wallet.

**What to build:**
1. Dashboard header accepts `name.eth` in the station search input (resolve to address on submit)
2. Dashboard shows ENS name for any station with reverse resolution
3. Station Status card displays ENS identity block with text records (`azimuth.credit-score`, `azimuth.tier`, `azimuth.location`)
4. Operators can see a link to set/update their records on `app.ens.domains`

**Pre-flight (do before the hackathon):** Go to `app.ens.domains` with your Station A wallet. Set these text records on your ENS name:
- `azimuth.credit-score` → `450`
- `azimuth.tier` → `Silver`
- `azimuth.location` → `New York, NY`

This is what judges see when they type your ENS name — live data from ENS, not hardcoded.

**ethers.js (already in dashboard/package.json) handles ENS natively:**
```js
// Forward: name → address
const address = await provider.resolveName("mystation.eth");
// Reverse: address → name
const name = await provider.lookupAddress("0xabc...");
// Text records
const resolver = await provider.getResolver("mystation.eth");
const tier = await resolver.getText("azimuth.tier");
```
Use Ethereum mainnet RPC for ENS (Cloudflare: `https://cloudflare-eth.com`) — ENS lives on mainnet, not Hedera.

**Demo script (90 seconds):**
1. Clear the address input, type `yourname.eth`, click Load Station
2. Dashboard loads: Station Status card shows ENS identity block in indigo with ENS name, tier, credit score
3. Say: "We turned a hex address into a portable DePIN identity. The credit score follows the ENS name. Operators can move wallets and keep their reputation."
4. Point to `app.ens.domains` link in the card so judges can verify records are live on ENS

**Effort:** ~4 hours. Must present at ENS booth Sunday morning.

---

## 3. Stretch Prize — World ID Track C: $1,500 (if time allows)

**Exact requirement:**
> "Existing projects that will integrate any of our SDKs (IDKit, Minikit, AgentKit) in a meaningful way"
> "Uses at least one World tool meaningfully"
> "Apps where the product breaks without proof of human"

**The story:** Ground station operators stake AZM to register. Without sybil resistance, one person could register 100 fake stations with no hardware and collect PoA rewards fraudulently. World ID verification on `registerStation()` proves each operator is a unique human. **Without proof of human, the network's economic model breaks** — which is exactly what Track B requires.

**What to build:** Add a World ID IDKit verification step before `registerStation()`. Operator proves humanity once, the proof is verified on-chain (or in a Hedera backend), then `registerStation()` is called with a verified flag.

**Do this only if you finish the core 3 prizes with time remaining.** The prize amount ($1,500) doesn't justify de-prioritizing the core work.

---

## 4. Execution Order

Order is based on: dependency (Walrus changes the storage layer everything else builds on) + effort (HSS is quick win, do it before ENS).

### Day 1 — Walrus Migration (~6 hours)
Walrus first because it changes core infrastructure. Do it while you're fresh.

**Step 1 — Create `hedera-client/walrus.js`** (30 min)
```js
const PUBLISHER  = "https://publisher.walrus-testnet.walrus.space";
const AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

async function uploadToWalrus(buffer, contentType = "application/json") {
  const res = await fetch(`${PUBLISHER}/v1/blobs?epochs=5`, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buffer,
  });
  const json = await res.json();
  const blobId = json.newlyCreated?.blobObject?.blobId
               ?? json.alreadyCertified?.blobId;
  if (!blobId) throw new Error(`Walrus upload failed: ${JSON.stringify(json)}`);
  return blobId;
}

async function downloadFromWalrus(blobId) {
  const res = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`Walrus download failed: ${blobId}`);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { uploadToWalrus, downloadFromWalrus, AGGREGATOR };
```

Verify it works before touching anything else:
```bash
node -e "
const { uploadToWalrus, downloadFromWalrus } = require('./walrus');
uploadToWalrus(Buffer.from('hello walrus'))
  .then(id => downloadFromWalrus(id))
  .then(buf => console.log('OK:', buf.toString()))
  .catch(console.error)
"
```

**Step 2 — Update `hedera-client/packetPublisher.js`** (45 min)

Add at top: `const { uploadToWalrus } = require("./walrus");`

In `publishPackets`, replace the Arweave upload block:
```js
// BEFORE
const arweaveTxId = await uploadToArweave(payload, tags);
await postHCS({ type:"packets", passId, station, arweaveTxId, ... });
return arweaveTxId;

// AFTER
const walrusBlobId = await uploadToWalrus(Buffer.from(JSON.stringify(payload)));
await postHCS({ type:"packets", passId, station, walrusBlobId, ... });
return walrusBlobId;
```

**Step 3 — Update `hedera-client/imageMerger.js`** (90 min)

Add at top: `const { uploadToWalrus, downloadFromWalrus } = require("./walrus");`

Replace `downloadFromArweave` with a function that handles both old (arweaveTxId) and new (walrusBlobId) messages:
```js
async function downloadPacketData(entry) {
  if (entry.walrusBlobId) {
    const buf = await downloadFromWalrus(entry.walrusBlobId);
    return JSON.parse(buf.toString("utf-8"));
  }
  // backward compat for old Arweave messages
  for (const url of [`https://devnet.irys.xyz/${entry.arweaveTxId}`, `https://arweave.net/${entry.arweaveTxId}`]) {
    const res = await fetch(url);
    if (res.ok) return res.json();
  }
  throw new Error(`No blob found for entry`);
}
```

In `tryMerge`: replace `downloadFromArweave(entry.arweaveTxId)` → `downloadPacketData(entry)`

Replace the Irys JPEG upload:
```js
// BEFORE
const irys = await getIrys();
const receipt = await irys.upload(jpegBuffer, { tags });
const arweaveTxId = receipt.id;
await recordAndAnnounce(passId, arweaveTxId, ...);

// AFTER
const walrusBlobId = await uploadToWalrus(jpegBuffer, "image/jpeg");
await recordAndAnnounce(passId, walrusBlobId, ...);
```

In `recordAndAnnounce`: rename param `arweaveTxId` → `blobId`, update HCS message:
```js
await postHCS({ type:"merged-image", passId, walrusBlobId: blobId, recovered, total, stations, timestamp });
```

Also update the `handleMessage` function to read `walrusBlobId` from HCS:
```js
const { passId, station, walrusBlobId, arweaveTxId, packetCount, totalPackets } = msg;
if (!passId || (!walrusBlobId && !arweaveTxId)) return;
passAnnouncements[passId].push({ station, walrusBlobId, arweaveTxId, packetCount, totalPackets });
```

**Step 4 — Update `image-dashboard/lib/arweave.js`** (30 min)

Add constant: `const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";`

In the message parsing block, update to use Walrus URL when available:
```js
const { passId, walrusBlobId, arweaveTxId, recovered, total, stations, timestamp } = parsed;
const imageUrl = walrusBlobId
  ? `${WALRUS_AGGREGATOR}/v1/blobs/${walrusBlobId}`
  : `${IRYS_GATEWAY}/${arweaveTxId}`;
results.push({ imageUrl, blobId: walrusBlobId || arweaveTxId, storageProvider: walrusBlobId ? "walrus" : "arweave", ... });
```

Commit after each step. Test by triggering a satellite pass and confirming terminal shows `[WALRUS] Uploaded`.

---

### Day 2 Morning — Hedera HSS UI (~3 hours)

**Step 5 — Create `hedera-client/api.js`** (45 min)

Node's built-in `http` module — no new dependencies:
```js
const http = require("http");
const { vault, wallet, provider } = require("./config");

async function handleRequest(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "POST" && req.url === "/api/schedule-unstake") {
    try {
      const nonce = await provider.getTransactionCount(wallet.address, "pending");
      const tx = await vault.requestUnstake({ gasLimit: 300_000, nonce });
      const receipt = await tx.wait();
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        txHash: receipt.hash,
        hashscanUrl: `https://hashscan.io/testnet/transaction/${receipt.hash}`
      }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));
}

function startApiServer() {
  http.createServer(handleRequest).listen(3002, () =>
    console.log("[API] Hedera bridge API on :3002")
  );
}

module.exports = { startApiServer };
```

Add to `hedera-client/index.js` (import + call `startApiServer()` inside `main()`).

**Step 6 — Create `dashboard/components/ScheduleCreator.js`** (45 min)
```jsx
"use client";
import { useState } from "react";

export default function ScheduleCreator() {
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);

  async function scheduleUnstake() {
    setStatus("loading"); setResult(null);
    try {
      const res = await fetch("/api/hedera/schedule-unstake", { method: "POST" });
      const data = await res.json();
      setStatus(data.success ? "success" : "error");
      setResult(data);
    } catch (err) {
      setStatus("error"); setResult({ error: err.message });
    }
  }

  return (
    <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/[0.06] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">HSS Schedule Actions</h3>
        <span className="text-xs text-slate-400 bg-slate-50 dark:bg-white/[0.03] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/[0.06]">Hedera Schedule Service</span>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Create on-chain scheduled transactions that execute automatically — no keeper, no cron job.
      </p>
      <button
        onClick={scheduleUnstake}
        disabled={status === "loading"}
        className="h-10 px-5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20"
      >
        {status === "loading" ? "Creating HSS Transaction..." : "Schedule Unstake (7-day cooldown via HSS)"}
      </button>

      {status === "success" && (
        <div className="mt-4 p-4 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl">
          <p className="text-xs font-semibold text-emerald-400 mb-2">HSS Transaction Scheduled</p>
          <p className="text-xs font-mono text-slate-500 break-all mb-2">{result.txHash}</p>
          <a href={result.hashscanUrl} target="_blank" rel="noreferrer"
            className="text-xs text-cyan-500 hover:underline">View on Hashscan →</a>
        </div>
      )}
      {status === "error" && (
        <div className="mt-4 p-4 bg-red-500/[0.06] border border-red-500/20 rounded-xl">
          <p className="text-xs font-semibold text-red-400 mb-1">Error</p>
          <p className="text-xs text-slate-500">{result?.error}</p>
        </div>
      )}
    </div>
  );
}
```

**Step 7 — Wire up** (30 min)

In `dashboard/next.config.js` add rewrites:
```js
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/api/hedera/:path*", destination: "http://localhost:3002/api/:path*" }];
  },
};
module.exports = nextConfig;
```

In `dashboard/app/page.js`:
- Import: `import ScheduleCreator from "../components/ScheduleCreator";`
- Add `<ScheduleCreator />` just before `<ScheduleTable schedules={data.schedules} />`

Test: click button → see Hashscan link → confirm HSS transaction visible on Hashscan.

---

### Day 2 Afternoon — ENS Identity (~4 hours)

**Step 8 — Create `dashboard/lib/ens.js`** (45 min)
```js
import { ethers } from "ethers";

// ENS lives on Ethereum mainnet — use public Cloudflare RPC
const ETH_RPC = "https://cloudflare-eth.com";
let _provider = null;
const getProvider = () => _provider ??= new ethers.JsonRpcProvider(ETH_RPC);

export async function resolveInput(input) {
  const trimmed = input.trim();
  if (trimmed.endsWith(".eth")) {
    const address = await getProvider().resolveName(trimmed);
    return { address, ensName: trimmed };
  }
  if (ethers.isAddress(trimmed)) {
    const ensName = await getProvider().lookupAddress(trimmed).catch(() => null);
    return { address: trimmed, ensName };
  }
  return { address: null, ensName: null };
}

export async function getAzimuthRecords(ensName) {
  try {
    const resolver = await getProvider().getResolver(ensName);
    if (!resolver) return null;
    const [creditScore, tier, location] = await Promise.all([
      resolver.getText("azimuth.credit-score").catch(() => null),
      resolver.getText("azimuth.tier").catch(() => null),
      resolver.getText("azimuth.location").catch(() => null),
    ]);
    return { creditScore, tier, location };
  } catch { return null; }
}
```

**Step 9 — Update `dashboard/components/Header.js`** (45 min)

Add import: `import { resolveInput } from "../lib/ens";`

Add state: `const [resolving, setResolving] = useState(false);`

Replace `handleSubmit` (currently only accepts addresses) with async version that resolves ENS:
```js
async function handleSubmit(e) {
  e.preventDefault();
  const trimmed = input.trim();
  if (!trimmed.endsWith(".eth") && !ethers.isAddress(trimmed)) {
    setInputError("Enter a valid address or ENS name (.eth)");
    return;
  }
  setInputError(""); setResolving(true);
  try {
    const { address } = await resolveInput(trimmed);
    if (!address) { setInputError("ENS name not found or invalid address"); return; }
    onConnect(address);
  } catch { setInputError("Resolution failed"); }
  finally { setResolving(false); }
}
```

Update placeholder: `placeholder="Station address 0x... or name.eth"`

Update submit button: `disabled={resolving}` and label `{resolving ? "Resolving..." : "Load Station"}`

**Step 10 — Update `dashboard/components/StationStatus.js`** (60 min)

Accept new props: `export default function StationStatus({ station, epochInterval, ensName, ensRecords })`

Add ENS block above the online/offline indicator:
```jsx
{ensName && (
  <div className="mb-4 p-3 bg-indigo-500/[0.06] border border-indigo-500/20 rounded-lg">
    <a href={`https://app.ens.domains/${ensName}`} target="_blank" rel="noreferrer"
      className="text-sm font-bold text-indigo-400 hover:underline">{ensName}</a>
    {ensRecords && (
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {ensRecords.tier && <span className="text-xs text-slate-400">Tier: <span className="text-indigo-300 font-semibold">{ensRecords.tier}</span></span>}
        {ensRecords.creditScore && <span className="text-xs text-slate-400">Score: <span className="text-indigo-300 font-semibold">{ensRecords.creditScore}</span></span>}
        {ensRecords.location && <span className="text-xs text-slate-400">Location: <span className="text-indigo-300 font-semibold">{ensRecords.location}</span></span>}
      </div>
    )}
  </div>
)}
```

**Step 11 — Wire ENS into `dashboard/app/page.js`** (30 min)

Add imports: `import { useEffect, useState } from "react"; import { resolveInput, getAzimuthRecords } from "../lib/ens";`

Add state: `const [ensName, setEnsName] = useState(null); const [ensRecords, setEnsRecords] = useState(null);`

Add effect after `useStationData` hook:
```js
useEffect(() => {
  if (!address) { setEnsName(null); setEnsRecords(null); return; }
  resolveInput(address)
    .then(({ ensName: name }) => { setEnsName(name); return name ? getAzimuthRecords(name) : null; })
    .then(records => setEnsRecords(records))
    .catch(() => {});
}, [address]);
```

Update `<StationStatus>` call: `<StationStatus station={data.station} epochInterval={data.epochInterval} ensName={ensName} ensRecords={ensRecords} />`

---

### Day 3 — Polish, Video, Submit

**Step 12 — Test everything end-to-end** (60 min)
- Run a satellite pass → confirm Walrus upload in logs
- Open image dashboard → image loads from Walrus URL
- Click "Schedule Unstake" → Hashscan shows HSS transaction
- Type your ENS name → station loads with ENS identity card

**Step 13 — Record 5-minute demo video** (60 min)

Segment structure:
| 0:00–0:30 | Problem intro | "Satellites pass overhead, most data is lost. Azimuth is a DePIN ground station network that captures it." |
| 0:30–2:00 | Walrus | Pass happens → Walrus upload in terminal → image loads from Walrus in dashboard → DevTools confirms URL |
| 2:00–3:30 | Hedera HSS | Click "Schedule Unstake" → Hashscan → ScheduleTable → "executes automatically, no keeper" |
| 3:30–4:30 | ENS | Type `name.eth` → dashboard loads → ENS identity card with text records live from ENS |
| 4:30–5:00 | Pitch | "Three integrations, one working product. Walrus stores the data. HSS settles rewards. ENS is the identity layer." |

**Step 14 — Update README** (30 min)

Add three sections to README:
- Walrus: "All packet data and satellite images stored on Walrus. Walrus blob IDs coordinate multi-station merging via Hedera HCS."
- Hedera HSS: "PoA epoch settlements and unstake cooldowns execute automatically via HSS. Dashboard includes user-facing schedule creation."
- ENS: "Station operators link ENS names for portable DePIN identity. Credit score and tier stored as azimuth.* text records."

**Step 15 — Submit to each prize track** (30 min)

Submit once to ETHGlobal, opt into each prize track separately with tailored description.

For Walrus submission, lead with:
> "Azimuth migrated from Arweave to Walrus as its decentralized storage backbone. Our multi-station merge protocol coordinates via Walrus blob IDs on Hedera HCS — without Walrus, coordination breaks."

For Hedera HSS submission, lead with:
> "We use all 4 Hedera services. The HSS automation demo: operators create scheduled transactions from the dashboard. Every settlement auto-executes — no keeper, no cron job, no trusted third party."

For ENS Continuity submission, lead with:
> "We added ENS as the identity layer for DePIN satellite operators. ENS names replace hex addresses. Credit score, tier, and location live as azimuth.* text records — portable reputation that follows the ENS name, not the private key."

For ENS "Integrate ENS" prize (separate opt-in, same project):
> "Our ENS integration: forward name resolution in the station search bar, reverse resolution to show ENS names for any station, and live reads of azimuth.credit-score / azimuth.tier / azimuth.location text records."

**Step 16 — ENS Booth, Sunday Morning**
- Bring the laptop. Have your ENS name pre-configured with text records.
- Show the live demo: type ENS name → station loads → text records appear.
- Speak to: "DePIN operator identity. The credit score follows the ENS name, not the wallet."

---

## 5. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Walrus testnet is down during demo | High — breaks Walrus prize | Keep `downloadPacketData` fallback to Arweave; show Walrus upload in terminal logs |
| `requestUnstake()` reverts (wrong state) | Medium — HSS prize demo fails | For demo: use `initializePoAEpoch()` instead — it also creates an HSS scheduled tx |
| ENS text records not resolved at demo | Medium — ENS prize looks weak | Set records 24h before; use mainnet ENS; test resolution with `vitalik.eth` as sanity check |
| ENS booth time clash on Sunday | High — required for ENS prizes | Schedule everything else Sat; Sunday morning = ENS booth only |
| Walrus WAL token balance runs out | Low — blobs are cheap | Fund with testnet WAL from faucet before hackathon begins |

---

## 6. Prize Confidence Summary

| Prize | Confidence | Why |
|---|---|---|
| Hedera HSS $1,000 | 95% | Already built. One UI button away. |
| Walrus $3,000 | 85% | 4 slots, perfect migration story, 1 day work |
| ENS "Integrate ENS" split ~$500-1,000 | 90% | Automatic qualifier once ENS code exists |
| ENS Continuity $2,500 | 65% | Only 2 prizes, need strong demo + Sunday booth |
| **Conservative total** | | **~$5,000–5,500** |
| **Optimistic total** | | **~$7,500** |
