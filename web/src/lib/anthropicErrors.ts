import Anthropic from "@anthropic-ai/sdk";

export function mapAnthropicError(err: unknown): { message: string; status: number } {
  if (err instanceof Anthropic.APIError) {
    if (err.status === 429) {
      return {
        message: "Rate limited by Anthropic — try again in a moment.",
        status: 429,
      };
    }
    if (err.status === 401 || err.status === 403) {
      return {
        message: "Anthropic authentication failed — check ANTHROPIC_API_KEY.",
        status: 500,
      };
    }
    if (err.status && err.status >= 500) {
      return {
        message: "Anthropic is having issues right now — try again.",
        status: 502,
      };
    }
    return { message: err.message || "Anthropic request failed", status: 502 };
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return { message: "Timed out waiting for Anthropic.", status: 504 };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { message: "Network error reaching Anthropic.", status: 502 };
  }
  return {
    message: err instanceof Error ? err.message : "Unknown error",
    status: 500,
  };
}
