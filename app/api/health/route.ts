import { NextResponse } from "next/server";

export async function GET() {
  const started = Date.now();
  const mode = process.env.MODE ?? "vies";

  return NextResponse.json({
    ok: true,
    ts: Date.now(),
    ms: Date.now() - started,
    mode,
  });
}
