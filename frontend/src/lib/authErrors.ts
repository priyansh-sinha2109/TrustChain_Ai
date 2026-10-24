/** Only status and recognised codes are exposed as diagnostics, never raw responses. */
export function authFailure(error: unknown) {
  const details = error && typeof error === "object" ? error as { status?: number; code?: string; message?: string } : {};
  const emailLimit = details.code === "over_email_send_rate_limit";
  const requestLimit = details.code === "over_request_rate_limit";
  const limited = emailLimit || requestLimit || details.status === 429;
  const message = emailLimit
    ? "Email delivery limit reached. Please wait before trying again, or sign in with an existing confirmed account. Your project administrator can configure custom SMTP."
    : limited
      ? "Too many authentication requests. Please wait before trying again. No account or login was confirmed."
      : details.code === "email_not_confirmed"
        ? "Confirm your email before signing in. Check your inbox and spam folder."
        : details.code === "invalid_credentials"
          ? "Invalid login credentials"
          : "Authentication could not be completed. Check your details and try again later.";
  const safeCodes = ["over_email_send_rate_limit", "over_request_rate_limit", "email_not_confirmed", "invalid_credentials"];
  return { message, limited, diagnostic: details.status ? `Auth HTTP ${details.status}${safeCodes.includes(details.code || "") ? ` · ${details.code}` : ""}` : "" };
}
