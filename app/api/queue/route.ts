import { NextResponse } from "next/server";
import { getVatResults } from "../../../lib/vat/store";
import type { VatRow } from "../../../lib/vat/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function dedupeLatest(rows: VatRow[]) {
  const seen = new Set<string>();
  const out: VatRow[] = [];

  // lijst is newest-first (lpush). Eerste die we zien is de nieuwste status.
  for (const r of rows) {
    const key = r.request_id ?? `${r.vat_number ?? ""}|${r.ts_created ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export async function GET() {
  const rows = await getVatResults(200);
  const results = dedupeLatest(rows);
  const res = NextResponse.json({ ok: true, results });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
