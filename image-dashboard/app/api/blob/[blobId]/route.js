const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

export async function GET(request, { params }) {
  const { blobId } = params;
  if (!blobId) return new Response("Missing blob ID", { status: 400 });

  const upstream = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
  if (!upstream.ok) {
    return new Response("Blob not found", { status: upstream.status });
  }

  const buffer = await upstream.arrayBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
