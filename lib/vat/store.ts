import { kv } from "@vercel/kv";
import type { VatRow } from "./types";

export const VAT_QUEUE_KEY = "vat:queue";
export const VAT_RESULTS_KEY = "vat:results";

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

export async function clearVatAll(): Promise<void> {
  await kv.del(VAT_QUEUE_KEY);
  await kv.del(VAT_RESULTS_KEY);
}
