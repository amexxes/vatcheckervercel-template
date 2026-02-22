import { NextResponse } from "next/server";
import { getVatResults } from "../../../lib/vat/store";

export async function GET() {
  const results = await getVatResults(200);
  return NextResponse.json({ ok: true, results });
}
