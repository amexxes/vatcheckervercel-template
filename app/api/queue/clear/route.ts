import { NextResponse } from "next/server";
import { clearVatAll } from "../../../../lib/vat/store";

export async function POST() {
  await clearVatAll();
  return NextResponse.json({ ok: true });
}
