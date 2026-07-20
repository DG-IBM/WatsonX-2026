import { NextRequest, NextResponse } from 'next/server';

// This route is kept for backward compat but is no longer called.
// The new system uses inline quiz scoring — no server debrief needed.
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use the inline quiz system.' },
    { status: 410 }
  );
}
