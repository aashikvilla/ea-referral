export type ApiErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "unavailable";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function fail(error: unknown): Response {
  if (error instanceof ApiError)
    return json(
      {
        ok: false,
        code: error.code,
        message: error.message,
        error: { code: error.code, message: error.message },
      },
      error.status,
    );
  return json(
    {
      ok: false,
      code: "unavailable",
      message: "The service is temporarily unavailable.",
      error: {
        code: "unavailable",
        message: "The service is temporarily unavailable.",
      },
    },
    503,
  );
}

export async function parseJson(
  request: Request,
  maxBytes = 32_000,
): Promise<unknown> {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json")
    throw new ApiError(415, "invalid_request", "Send a JSON request.");
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes)
    throw new ApiError(413, "invalid_request", "Request is too large.");
  if (!request.body)
    throw new ApiError(400, "invalid_request", "Request body is empty.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, "invalid_request", "Request is too large.");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      "invalid_request",
      "Request body could not be read.",
    );
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ApiError(
      400,
      "invalid_request",
      "Request body is not valid UTF-8.",
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, "invalid_request", "Request JSON is invalid.");
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const bearer = /^Bearer [\w.-]+$/.test(
    request.headers.get("authorization") ?? "",
  );
  if (!origin) {
    if (bearer) return;
    throw new ApiError(403, "forbidden", "A same-origin request is required.");
  }
  let expected: string;
  try {
    expected = new URL(process.env.APP_ORIGIN ?? "").origin;
  } catch {
    throw new ApiError(403, "forbidden", "Request origin is not allowed.");
  }
  try {
    if (new URL(origin).origin !== expected)
      throw new ApiError(403, "forbidden", "Request origin is not allowed.");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, "forbidden", "Request origin is not allowed.");
  }
}

export function enforceContentLength(request: Request, maxBytes: number): void {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > maxBytes)
    throw new ApiError(413, "invalid_request", "Request is too large.");
}
