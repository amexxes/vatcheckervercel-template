import { NextResponse } from "next/server";
import { getVatResults } from "../../../lib/vat/store";
import type { VatRow } from "../../../lib/vat/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function dedupeLatest(rows: VatRow[]): VatRow[] {
  // resultatenlijst is "nieuwste eerst" (lpush). We houden de eerste per request_id.
  const seen = new Set<string>();
  const out: VatRow[] = [];

  for (const r of rows) {
    const key =
      r.request_id ??
      `${r.vat_number ?? ""}|${r.ts_created ?? ""}|${r.ts_updated ?? ""}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }

  return out;
}

export async function GET() {
  const results = dedupeLatest(await getVatResults(200));
  const res = NextResponse.json({ ok: true, results });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
