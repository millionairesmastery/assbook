// One fetch wrapper for every Assbook API call. It keeps raw parse failures and
// stack traces away from the interface: callers only ever see friendly copy.
const GENERIC = "Assbook is having a moment. Please try again.";
const BREATHER = "A little breather. Please try again shortly.";
const SIGN_IN = "Join or sign in to do that.";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Thrown by local checks (matching passwords, file size) whose message is
// already written for a human and is safe to show.
export class FriendlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FriendlyError";
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function errorMessage(error: unknown, fallback = GENERIC): string {
  if (error instanceof ApiError || error instanceof FriendlyError)
    return error.message || fallback;
  return fallback;
}

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!type.includes("application/json")) return null;
  try {
    const parsed: unknown = await res.json();
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin", ...init });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError(GENERIC, 0);
  }
  const data = await readJson(res);
  if (res.ok) {
    if (!data) throw new ApiError(GENERIC, res.status);
    return data as T;
  }
  const raw = data?.error;
  const fromServer = typeof raw === "string" ? raw.trim() : "";
  if (res.status === 401) throw new ApiError(SIGN_IN, 401);
  if (res.status === 429) throw new ApiError(fromServer || BREATHER, 429);
  if (res.status >= 500 || !fromServer) throw new ApiError(GENERIC, res.status);
  throw new ApiError(fromServer, res.status);
}

export function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;
  return send<T>("/api/" + path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
}

export function uploadPhoto(
  file: File,
  signal?: AbortSignal,
): Promise<{ url: string }> {
  return send<{ url: string }>("/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Photo-Rules": "accepted",
    },
    body: file,
    signal,
  });
}
