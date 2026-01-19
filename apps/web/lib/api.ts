import { NextResponse } from "next/server";

type ErrorDetails = Record<string, unknown> | string | null;

type ApiError = {
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
};

export function jsonError(
  code: string,
  message: string,
  details: ErrorDetails = null,
  status = 400
) {
  const payload: ApiError = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  return NextResponse.json(payload, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}
