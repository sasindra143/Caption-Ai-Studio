export interface GeminiErrorDetails {
  status?: number;
  code?: string;
  message?: string;
}

export function getGeminiErrorDetails(error: unknown): GeminiErrorDetails {
  if (typeof error !== "object" || error === null) return {};
  const errorRecord = error as Record<string, unknown>;
  const status = typeof errorRecord.status === "number" ? errorRecord.status : undefined;
  const rawMessage = error instanceof Error
    ? error.message
    : typeof errorRecord.message === "string" ? errorRecord.message : undefined;
  let code = errorRecord.code === undefined ? undefined : String(errorRecord.code);
  let message = rawMessage;
  if (rawMessage) {
    try {
      const decoded: unknown = JSON.parse(rawMessage);
      if (typeof decoded === "object" && decoded !== null && "error" in decoded) {
        const body = (decoded as { error?: unknown }).error;
        if (typeof body === "object" && body !== null) {
          const detail = body as Record<string, unknown>;
          if (detail.code !== undefined) code = String(detail.code);
          if (typeof detail.status === "string") code = detail.status;
          if (typeof detail.message === "string") message = detail.message;
        }
      }
    } catch {
      // The SDK also uses plain-text messages for network and timeout failures.
    }
  }
  return {
    ...(status === undefined ? {} : { status }),
    ...(code === undefined ? {} : { code }),
    ...(message === undefined ? {} : { message }),
  };
}

export function geminiHttpStatus(error: unknown): number | undefined {
  const { status, code, message } = getGeminiErrorDetails(error);
  const diagnostic = `${code ?? ""} ${message ?? ""}`;
  if (status === 400 || /INVALID_ARGUMENT|invalid argument/i.test(diagnostic)) return 400;
  if (status === 401 || status === 403 || /UNAUTHENTICATED|PERMISSION_DENIED|API key not valid|unauthorized|permission denied/i.test(diagnostic)) return 503;
  if (status === 404 || /NOT_FOUND|model .*not found|not supported for.*generate/i.test(diagnostic)) return 503;
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(diagnostic)) return 429;
  if (status === 408 || status === 504 || /timeout|timed out|ETIMEDOUT/i.test(diagnostic)) return 504;
  if (status === 500 || status === 502 || status === 503 || /INTERNAL|UNAVAILABLE|backend error/i.test(diagnostic)) return 503;
  if (status !== undefined && status >= 500) return 503;
  if (status !== undefined && status >= 400) return 502;
  return undefined;
}

export function geminiClientMessage(error: unknown): string {
  const { status, code, message } = getGeminiErrorDetails(error);
  switch (geminiHttpStatus(error)) {
    case 400:
      return "Gemini rejected the translation request as invalid. Check the caption payload and configured model.";
    case 429:
      return "Gemini API quota or rate limit reached. Review the Google AI Studio plan and limits, then try again later.";
    case 503:
      if (status === 401 || status === 403 || /UNAUTHENTICATED|PERMISSION_DENIED|API key not valid|unauthorized|permission denied/i.test(`${code ?? ""} ${message ?? ""}`)) {
        return "Gemini rejected the backend credentials or permissions. Check GEMINI_API_KEY and its Google AI Studio restrictions in Render.";
      }
      if (status === 404 || /NOT_FOUND|model .*not found|not supported for.*generate/i.test(`${code ?? ""} ${message ?? ""}`)) {
        return "The configured Gemini model or API endpoint is unavailable. Check GEMINI_TEXT_MODEL and its API access.";
      }
      return "Gemini is temporarily unavailable. Check the Google AI status and try again.";
    case 504:
      return "Gemini did not respond before the request timed out. Please try again later.";
    case 502:
      return "Gemini returned an unexpected upstream error. Check the backend diagnostics and Google AI status.";
    default:
      return "Gemini could not complete this request. Check the backend diagnostics and Gemini API status.";
  }
}

export function geminiSafeDiagnostic(error: unknown): string {
  const { status, code, message } = getGeminiErrorDetails(error);
  const safeMessage = (message ?? "No upstream message.")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/\S+/gi, "[redacted URL]")
    .replace(/(?:[A-Za-z]:\\|\/)(?:[^\s"'<>]+[\\/])*[^\s"'<>]*/g, "[redacted path]")
    .replace(/\s+/g, " ")
    .slice(0, 240);
  return `status=${status ?? "network"} code=${code ?? "unknown"} message="${safeMessage}"`;
}
