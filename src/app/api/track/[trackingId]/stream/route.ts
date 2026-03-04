import { NextResponse } from "next/server";

// SSE endpoint for live GPS tracking — no auth required
// Will be implemented with the Catering Tracker System
export async function GET() {
  return NextResponse.json(
    { error: "Tracking system not yet available" },
    { status: 404 }
  );
}
