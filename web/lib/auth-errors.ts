export type AuthNotice = {
  title: string;
  description: string;
};

export function appendAuthNotice(url: string, code: string) {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const nextUrl = new URL(url, base);
  nextUrl.searchParams.set("authNotice", code);
  return `${nextUrl.pathname}${nextUrl.search}`;
}

export function authNoticeFromParams(params: URLSearchParams): AuthNotice | null {
  const notice = params.get("authNotice");
  const rawError = [
    params.get("error"),
    params.get("error_description"),
    params.get("message"),
    params.get("code"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (notice?.includes("cancel") || rawError.includes("cancel") || rawError.includes("access_denied")) {
    return {
      title: "Authentication cancelled",
      description: "No changes were made. You can try again whenever you are ready.",
    };
  }

  if (notice === "discord-link-failed") {
    return {
      title: "Discord link was not completed",
      description: "Your dashboard account is still safe. Try linking Discord again when you are ready.",
    };
  }

  if (rawError) {
    return {
      title: "Authentication could not be completed",
      description: "Try again, or use a different sign-in method if the problem continues.",
    };
  }

  return null;
}

export function friendlyPasskeyError(
  message?: string,
  action: "register" | "sign-in" = "register",
) {
  const lower = (message ?? "").toLowerCase();
  const cancelled =
    lower.includes("cancel") ||
    lower.includes("not allowed") ||
    lower.includes("aborted") ||
    lower.includes("timed out");
  if (cancelled) {
    return action === "sign-in"
      ? "Passkey sign-in was cancelled or timed out."
      : "Passkey registration was cancelled. No passkey was added.";
  }
  return action === "sign-in"
    ? "Couldn't complete passkey sign-in. Please try again."
    : message || "Could not complete the passkey action.";
}
