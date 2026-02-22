import { kv } from "@vercel/kv";
import type { VatRow } from "./types";

export const VAT_QUEUE_KEY = "vat:queue";
export const VAT_RESULTS_KEY = "vat:results";
export const VAT_MAX_RESULTS = 1000;

function toVatRow(v: unknown): VatRow | null {
  if (!v) return null;

  // Als er al oude data als string staat, blijven we die ook ondersteunen:
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

export async function getVatResults(limit = 200): Promise<VatRow[]> {
  const end = Math.max(limit - 1, 0);
  const raw = (await kv.lrange(VAT_RESULTS_KEY, 0, end)) as unknown[];
  return raw.map(toVatRow).filter((x): x is VatRow => Boolean(x));
}

export async function pushVatResults(rows: VatRow[], max = VAT_MAX_RESULTS): Promise<void> {
  if (!rows?.length) return;
  await kv.lpush(VAT_RESULTS_KEY, ...rows); // object direct opslaan
  await kv.ltrim(VAT_RESULTS_KEY, 0, max - 1);
}

export async function enqueueVatRows(rows: VatRow[]): Promise<void> {
  if (!rows?.length) return;
  await kv.rpush(VAT_QUEUE_KEY, ...rows); // object direct opslaan
}

export async function clearVatAll(): Promise<void> {
  await kv.del(VAT_QUEUE_KEY);
  await kv.del(VAT_RESULTS_KEY);
}
