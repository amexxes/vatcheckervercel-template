import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { VatRow } from "../../../lib/vat/types";
import { VAT_QUEUE_KEY, pushVatResults } from "../../../lib/vat/store";
import { guessCountryCode, normalizeVat, stripCountryPrefix } from "../../../lib/vat/utils";
import { checkVatVies } from "../../../lib/vat/vies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toVatRow(v: unknown): VatRow | null {
  if (!v) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as VatRow;
    } catch {
      return null;
    }
  }
  if (typeof v === "object") return v as VatRow;
  return null;
}

async function popQueueBatch(n: number): Promise<VatRow[]> {
  const out: VatRow[] = [];
  for (let i = 0; i < n; i++) {
    const item = await kv.lpop(VAT_QUEUE_KEY);
    if (!item) break;
    const row = toVatRow(item);
    if (row) out.push(row);
  }
  return out;
}

function withUpdate(base: VatRow, patch: Partial<VatRow>): VatRow {
  return { ...base, ...patch, ts_updated: Date.now() };
}

async function runWorker(max: number) {
  const items = await popQueueBatch(max);
  const results: VatRow[] = [];

  for (const row of items) {
    const vat = normalizeVat(row.vat_number ?? row.input);
    const countryCode = (row.country_code ?? guessCountryCode(vat)).toUpperCase();
    const vatPart = row.vat_part ?? stripCountryPrefix(vat);

    if (!vat || !countryCode || !vatPart) {
      results.push(withUpdate(row, { state: "error", valid: null, error: "missing vat/country/vat_part" }));
      continue;
    }

    try {
      const v = await checkVatVies(countryCode, vatPart);
      results.push(
        withUpdate(row, { state: "done", valid: v.valid, name: v.name, address: v.address, error: "", source: "vies" })
      );
    } catch (e: any) {
      results.push(withUpdate(row, { state: "error", valid: null, error: e?.message ?? String(e), source: "vies" }));
    }
  }

  if (results.length) await pushVatResults(results);
  const queue_len = await kv.llen(VAT_QUEUE_KEY);

  return { processed: results.length, queue_len, results };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const max = Math.min(Number(url.searchParams.get("max") ?? 5), 10);
  const data = await runWorker(max);
  const res = NextResponse.json({ ok: true, ...data });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const max = Math.min(Number(body?.max ?? 5), 10);
  const data = await runWorker(max);
  const res = NextResponse.json({ ok: true, ...data });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
