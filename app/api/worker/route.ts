import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { VatRow } from "../../../lib/vat/types";
import { VAT_QUEUE_KEY, pushVatResults } from "../../../lib/vat/store";
import { guessCountryCode, normalizeVat, stripCountryPrefix } from "../../../lib/vat/utils";
import { checkVatVies } from "../../../lib/vat/vies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function popQueueBatch(n: number): Promise<VatRow[]> {
  const out: VatRow[] = [];
  for (let i = 0; i < n; i++) {
    const item = await kv.lpop(VAT_QUEUE_KEY);
    if (!item) break;
    try {
      out.push(JSON.parse(String(item)) as VatRow);
    } catch {
      // skip
    }
  }
  return out;
}

function doneRow(base: VatRow, patch: Partial<VatRow>): VatRow {
  return {
    ...base,
    ...patch,
    ts_updated: Date.now(),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const max = Math.min(Number(url.searchParams.get("max") ?? 5), 25);

  const items = await popQueueBatch(max);
  const results: VatRow[] = [];

  for (const row of items) {
    const vat = normalizeVat(row.vat_number ?? row.input);
    const countryCode = (row.country_code ?? guessCountryCode(vat)).toUpperCase();
    const vatNumber = row.vat_part ?? stripCountryPrefix(vat);

    if (!vat || !countryCode || !vatNumber) {
      results.push(
        doneRow(row, { state: "error", valid: null, error: "missing vat/country/vat_part", source: "worker" })
      );
      continue;
    }

    try {
      const v = await checkVatVies(countryCode, vatNumber);
      results.push(
        doneRow(row, { state: "done", valid: v.valid, name: v.name, address: v.address, error: "", source: "vies" })
      );
    } catch (e: any) {
      results.push(
        doneRow(row, { state: "error", valid: null, error: e?.message ?? String(e), source: "vies" })
      );
    }
  }

  if (results.length) await pushVatResults(results);

  const queue_len = await kv.llen(VAT_QUEUE_KEY);

  const res = NextResponse.json({ ok: true, processed: results.length, queue_len, results });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
