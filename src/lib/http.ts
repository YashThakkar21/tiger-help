import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";

/** Turns thrown errors into JSON responses; keeps route handlers tidy. */
export function errorResponse(e: unknown) {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/** A caught expected error with a status code (e.g. bad input, wrong state). */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiError(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return errorResponse(e);
}
