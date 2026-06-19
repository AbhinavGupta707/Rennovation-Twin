import { NextResponse } from "next/server";
import { fail, ok, type ApiResponse } from "@renovation-twin/types";

export function jsonOk<T>(
  data: T,
  init?: ResponseInit,
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(ok(data), init);
}

export function jsonFail(
  code: string,
  message: string,
  status = 400,
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(fail(code, message), { status });
}
