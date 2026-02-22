import { NextResponse } from "next/server";
import { enqueueVatRows, pushVatResults } from "../../../lib/vat/store";
import { makeQueuedRow } from "../../../lib/vat/utils";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body?.items) ? body.items : [];

  const rows = items
    .map((it: any) => makeQueuedRow(it, "batch"))
    .filter((r) => Boolean(r.vat_number));

  if (rows.length) {
    await enqueueVatRows(rows);
    await pushVatResults(rows);
  }

  return NextResponse.json({ ok: true, results: rows, queued: rows.length });
}
