type AuthFailure = { code?: string; status?: number };

const messages: Record<string, string> = {
  invalid_input: "Enter a valid email and a password of at least 8 characters.",
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Confirm your email before signing in. Check your inbox and spam folder for the confirmation link.",
  rate_limited: "Too many attempts or emails requested. Please wait before trying again.",
  email_unavailable: "We cannot send a confirmation email right now. Please contact support.",
  weak_password: "Choose a stronger password of at least 8 characters.",
  signup_failed: "Registration could not be completed. Please try again later.",
  auth_failed: "Sign in is temporarily unavailable. Please try again later.",
  callback_failed: "This sign-in link could not be verified. Use the latest link in the browser where you requested it. If the problem continues, contact support.",
};

export function authErrorMessage(code: string) {
  return messages[code] ?? "Authentication failed. Please try again.";
}

export function authErrorCode(error: AuthFailure, fallback: string) {
  if (error.status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(error.code ?? "")) {
    return "rate_limited";
  }
  if (error.code === "email_address_not_authorized") return "email_unavailable";
  if (["email_not_confirmed", "invalid_credentials", "weak_password"].includes(error.code ?? "")) {
    return error.code!;
  }
  return fallback;
}

export function logAuthFailure(operation: string, error: AuthFailure) {
  // Log only diagnostic codes, never credentials, tokens or provider messages.
  console.error("Supabase Auth failure", { operation, code: error.code ?? "unknown", status: error.status });
}
