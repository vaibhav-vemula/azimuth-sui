# Walrus Sites — decentralized hosting for the Azimuth dashboards

Host the Azimuth frontends entirely on Walrus + Sui (no centralized server), so the
whole stack — data, logic, and UI — is decentralized.

## Which app to deploy

- **`dashboard/` (station ops)** — fully client-side: all reads go through `SuiClient`
  in the browser. This static-exports cleanly and is the recommended Walrus Site.
- **`image-dashboard/` (gallery)** — uses a Next.js API route (`/api/blob`) to proxy
  Walrus blobs for inline display. Static export can't run that route, so for a
  Walrus Site build, point `imageUrl` straight at the Walrus aggregator
  (`https://aggregator.walrus-testnet.walrus.space/v1/blobs/<blobId>`) instead of
  `/api/blob/<blobId>` in `lib/walrus.js`, then export.

## Prerequisites

```bash
# Sui CLI + Walrus CLI configured for testnet, with SUI + WAL funds.
cargo install --git https://github.com/MystenLabs/walrus-sites site-builder
# or download a site-builder release binary
```

## Build a static export

In `dashboard/next.config.js` add `output: "export"` (and `images: { unoptimized: true }`),
then:

```bash
cd dashboard
npm run build          # produces ./out
```

## Publish to Walrus Sites

```bash
site-builder publish ./out --epochs 5
# → prints the Site object id + the https://<base36>.wal.app URL
```

To update later: `site-builder update ./out <site-object-id> --epochs 5`.

`ws-resources.json` (in each app's `out/`) can set routing/headers — see the template here.
