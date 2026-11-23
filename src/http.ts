export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable: boolean,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 60_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new HttpError(`Network/timeout error: ${(e as Error).message}`, 0, true);
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 300);
    const retryAfter = Number(res.headers.get('retry-after'));
    const retryable = res.status === 429 || res.status >= 500;
    throw new HttpError(
      `HTTP ${res.status}: ${body}`,
      res.status,
      retryable,
      retryAfter > 0 ? retryAfter * 1000 : undefined,
    );
  }
  return (await res.json()) as T;
}
