import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

// Who am I? Used by the client to render the right view. Returns null when the
// dev cookie (later: CAS session) isn't set.
export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
  } catch (e) {
    return errorResponse(e);
  }
}
