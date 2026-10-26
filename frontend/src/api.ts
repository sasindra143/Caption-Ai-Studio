const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return configuredApiBaseUrl ? new URL(path, `${configuredApiBaseUrl}/`).toString() : path;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), init);
  } catch {
    throw new Error("Could not connect to the caption API. Check VITE_API_BASE_URL and make sure the backend is running.");
  }
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (response.status >= 500 && !contentType.includes("application/json")) {
      throw new Error("Could not reach the caption backend. Check VITE_API_BASE_URL and the backend deployment logs.");
    }
    const result = contentType.includes("application/json")
      ? await response.json().catch(() => ({ error: response.statusText })) as { error?: string }
      : { error: response.statusText };
    const fallbackMessages: Record<number, string> = {
      400: "The request is invalid. Check the selected language and caption settings.",
      404: "The project or media file could not be found. Reload the project and try again.",
      429: "The service is busy or the Gemini quota was reached. Wait before trying again.",
      413: "The video is larger than the configured upload limit.",
      415: "Choose an MP4, MOV, or WebM video file.",
      500: "The backend encountered an unexpected error. Check the backend logs for details.",
      502: "Gemini could not complete this translation. Try again later.",
      503: "The backend or a required service is unavailable. Check the service configuration and logs.",
      504: "Gemini took too long to respond. Please try again later.",
    };
    throw new Error(result.error && result.error !== response.statusText
      ? result.error
      : fallbackMessages[response.status] ?? `Request failed (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
