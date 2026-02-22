import { NextResponse } from "next/server";
import { getVatResults } from "../../../lib/vat/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const results = await getVatResults(200);
  const res = NextResponse.json({ ok: true, results });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
