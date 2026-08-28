window.CASHLY_CONFIG = Object.freeze({
  callbackForm: {
    endpoint: "https://pklhknmvgdeytwhjnwxf.supabase.co/functions/v1/submit-callback-request",
    // Production Turnstile site key.
    turnstileSiteKey: "0x4AAAAAAC8juGqteiCCKx2g"
  },
  eventLeadForm: {
    endpoint: "https://pklhknmvgdeytwhjnwxf.supabase.co/functions/v1/submit-event-lead",
    // Reuses the same production Turnstile site key/domain as callbackForm.
    turnstileSiteKey: "0x4AAAAAAC8juGqteiCCKx2g"
  }
});
