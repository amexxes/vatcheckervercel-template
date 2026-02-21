import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export async function GET() {
  const ts = Date.now();
  await kv.set("health:last", ts);
  const value = await kv.get<number>("health:last");
  return NextResponse.json({ ok: true, value });
}
