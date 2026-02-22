import { kv } from "@vercel/kv";
import type { VatRow } from "./types";

export const VAT_QUEUE_KEY = "vat:queue";
export const VAT_RESULTS_KEY = "vat:results";
export const VAT_MAX_RESULTS = 1000;

export async function getVatResults(limit = 200): Promise<VatRow[]> {
  const end = Math.max(limit - 1, 0);
  const raw = (await kv.lrange(VAT_RESULTS_KEY, 0, end)) as unknown as string[];

  return raw
    .map((s) => {
      try {
        return JSON.parse(s) as VatRow;
      } catch {
        return null;
      }
    })
    .filter((x): x is VatRow => Boolean(x));
}

export async function pushVatResults(rows: VatRow[], max = VAT_MAX_RESULTS): Promise<void> {
  if (!rows?.length) return;
  for (const r of rows) {
    await kv.lpush(VAT_RESULTS_KEY, JSON.stringify(r));
  }
  await kv.ltrim(VAT_RESULTS_KEY, 0, max - 1);
}

export async function enqueueVatRows(rows: VatRow[]): Promise<void> {
  if (!rows?.length) return;
  await kv.rpush(VAT_QUEUE_KEY, ...rows.map((r) => JSON.stringify(r)));
}

export async function clearVatAll(): Promise<void> {
  await kv.del(VAT_QUEUE_KEY);
  await kv.del(VAT_RESULTS_KEY);
}
