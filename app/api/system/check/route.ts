import { NextResponse } from "next/server";
import { checkSystem } from "@/lib/system-check";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await checkSystem());
}
