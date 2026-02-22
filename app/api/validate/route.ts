import { NextResponse } from "next/server";
import { enqueueVatRows, pushVatResults } from "../../../lib/vat/store";
import { makeQueuedRow } from "../../../lib/vat/utils";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const row = makeQueuedRow(body, "single");

  if (!row.vat_number) {
    return NextResponse.json({ ok: false, error: "missing vat_number" }, { status: 400 });
  }

  await enqueueVatRows([row]);
  await pushVatResults([row]);

  return NextResponse.json({ ok: true, result: row });
}
