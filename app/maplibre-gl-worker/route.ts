import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const worker = await readFile(join(process.cwd(), "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"));
  return new Response(worker, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
