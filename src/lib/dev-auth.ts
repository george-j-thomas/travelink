/**
 * Dev auth bypass (DEV_AUTH_BYPASS=true) skips login entirely. It is hard-disabled
 * in production builds so a stray env var can never open up a deployed app.
 */
export const DEV_AUTH_BYPASS =
  process.env.DEV_AUTH_BYPASS === "true" && process.env.NODE_ENV !== "production"
