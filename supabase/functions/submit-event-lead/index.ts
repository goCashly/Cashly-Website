import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

// Intake for the in-person event QR code -> lead form.
// Simpler than submit-callback-request in most respects (no identity
// blocking, much higher rate-limit ceilings, since many attendees can share
// one venue Wi-Fi IP) but still requires a Turnstile token, same as the
// homepage callback form, so a script can't POST here directly without
// solving the challenge in a real browser first.

const MAX_LENGTHS = {
  name: 150,
  email: 255,
  phone: 40,
  company: 150,
  position: 150,
  eventName: 150,
  sourcePage: 255
};

const successMessage = "Thanks! You're all set — see you at the booth.";
const rateLimitUnavailableMessage = "We can't accept sign-ups right now. Please try again shortly.";

// Generous limits: many attendees can share one venue IP address.
const ATTEMPT_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const ATTEMPT_RATE_LIMIT_MAX_REQUESTS = 120;
const SUBMISSION_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const SUBMISSION_RATE_LIMIT_MAX_REQUESTS = 80;
const DAILY_SUBMISSION_RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;
const DAILY_SUBMISSION_RATE_LIMIT_MAX_REQUESTS = 400;
const RATE_LIMIT_ERROR_RETRY_AFTER_SECONDS = 60;

const DEFAULT_EVENT_NAME = "Sales Growth Academy";

const STORAGE_SAFE_CHARACTER_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
} as Record<string, string>;

const CONTROL_CHARACTER_PATTERN = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]",
  "g"
);

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
  headers: HeadersInit = {}
) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...headers
    }
  });
};

const getStringValue = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
};

const makeStorageSafeText = (value: string) => {
  return value
    .replace(CONTROL_CHARACTER_PATTERN, "")
    .replace(/[&<>"']/g, (character) => STORAGE_SAFE_CHARACTER_MAP[character] || character);
};

const isValidEmail = (value: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const normalizePhone = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  const hasLeadingPlus = trimmedValue.startsWith("+");
  const digitsOnly = trimmedValue.replace(/\D/g, "");

  if (!digitsOnly) {
    return "";
  }

  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
};

const isValidIpv4 = (value: string) => {
  return /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(value);
};

const isValidIpv6 = (value: string) => {
  return value.length <= 45 &&
    value.includes(":") &&
    /^[0-9a-f:]+$/i.test(value);
};

const sanitizeIpAddress = (value: string) => {
  const trimmedValue = value.trim().replace(/^\[|\]$/g, "");

  if (!trimmedValue) {
    return "";
  }

  if (trimmedValue.includes(".") && trimmedValue.includes(":")) {
    const [hostPart, portPart] = trimmedValue.split(":");

    if (hostPart && portPart && /^\d+$/.test(portPart)) {
      return hostPart;
    }
  }

  return trimmedValue;
};

const getClientIp = (request: Request) => {
  const candidateHeaders = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip")
  ];

  for (const headerValue of candidateHeaders) {
    if (!headerValue) {
      continue;
    }

    const firstValue = headerValue.split(",")[0];
    const sanitizedValue = sanitizeIpAddress(firstValue);

    if (isValidIpv4(sanitizedValue) || isValidIpv6(sanitizedValue)) {
      return sanitizedValue;
    }
  }

  return "";
};

const sha256Hex = async (value: string) => {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const createSupabaseAdminClient = (
  supabaseUrl: string,
  supabaseServiceRoleKey: string
) => {
  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

const verifyTurnstileToken = async (
  token: string,
  ipAddress: string,
  turnstileSecretKey: string
) => {
  const formData = new FormData();
  formData.append("secret", turnstileSecretKey);
  formData.append("response", token);

  if (ipAddress) {
    formData.append("remoteip", ipAddress);
  }

  const verificationResponse = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData
    }
  );

  if (!verificationResponse.ok) {
    return { success: false };
  }

  const verificationResult = await verificationResponse.json();

  return {
    success: verificationResult.success === true
  };
};

const getRateLimitIdentitySource = ({
  clientIp,
  email,
  phone,
  userAgent
}: {
  clientIp: string,
  email: string,
  phone: string,
  userAgent: string
}) => {
  if (clientIp) {
    return clientIp;
  }

  return [email, phone, userAgent].filter(Boolean).join("|") || "anonymous";
};

const buildRateLimitKey = (bucketName: string, identityHash: string) => {
  return `event-lead-${bucketName}:${identityHash}`;
};

const enforceRateLimit = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  rateLimitKey: string,
  windowSeconds: number,
  maxRequests: number,
  message: string
) => {
  const { data: rateLimitResult, error: rateLimitError } = await supabaseAdmin
    .rpc("bump_callback_rate_limit", {
      p_ip_hash: rateLimitKey,
      p_window_seconds: windowSeconds,
      p_limit: maxRequests
    })
    .single();

  if (rateLimitError || !rateLimitResult) {
    console.error("Event lead rate limit check failed:", {
      rateLimitKey,
      rateLimitError
    });

    return jsonResponse(
      { success: false, message: rateLimitUnavailableMessage },
      503,
      {
        "Retry-After": String(RATE_LIMIT_ERROR_RETRY_AFTER_SECONDS)
      }
    );
  }

  if (rateLimitResult.allowed !== true) {
    return jsonResponse(
      { success: false, message },
      429,
      {
        "Retry-After": String(
          rateLimitResult.retry_after_seconds || windowSeconds
        )
      }
    );
  }

  return null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { success: false, message: "Method not allowed." },
      405
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const turnstileSecretKey = Deno.env.get("TURNSTILE_SECRET_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey || !turnstileSecretKey) {
    console.error("Missing required function secrets.");

    return jsonResponse(
      { success: false, message: "Server configuration is incomplete." },
      500
    );
  }

  let requestBody: Record<string, unknown>;

  try {
    requestBody = await request.json();
  } catch (_error) {
    return jsonResponse(
      { success: false, message: "Invalid request body." },
      400
    );
  }

  const name = getStringValue(requestBody.name, MAX_LENGTHS.name);
  const email = getStringValue(requestBody.email, MAX_LENGTHS.email).toLowerCase();
  const rawPhone = getStringValue(requestBody.phone, MAX_LENGTHS.phone);
  const phone = normalizePhone(rawPhone);
  const company = getStringValue(requestBody.company, MAX_LENGTHS.company);
  const position = getStringValue(requestBody.position, MAX_LENGTHS.position);
  const eventName = getStringValue(requestBody.event_name, MAX_LENGTHS.eventName) || DEFAULT_EVENT_NAME;
  const sourcePage = getStringValue(requestBody.source_page, MAX_LENGTHS.sourcePage);
  const turnstileToken = getStringValue(requestBody.turnstile_token, 2048);
  // Honeypot: a real attendee never fills this hidden field.
  const honeypot = getStringValue(requestBody.website, 200);
  const clientIp = getClientIp(request);
  const userAgent = getStringValue(request.headers.get("user-agent"), 500);

  if (honeypot) {
    return jsonResponse({ success: true, message: successMessage });
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );
    const rateLimitIdentitySource = getRateLimitIdentitySource({
      clientIp,
      email,
      phone: rawPhone || phone,
      userAgent
    });
    const rateLimitIdentityHash = await sha256Hex(rateLimitIdentitySource);

    const attemptRateLimitResponse = await enforceRateLimit(
      supabaseAdmin,
      buildRateLimitKey("attempt", rateLimitIdentityHash),
      ATTEMPT_RATE_LIMIT_WINDOW_SECONDS,
      ATTEMPT_RATE_LIMIT_MAX_REQUESTS,
      "Too many attempts. Please wait a few minutes and try again."
    );

    if (attemptRateLimitResponse) {
      return attemptRateLimitResponse;
    }

    if (!name || !email || !phone || !company || !position) {
      return jsonResponse(
        { success: false, message: "Please fill in all fields before submitting." },
        400
      );
    }

    if (!isValidEmail(email)) {
      return jsonResponse(
        { success: false, message: "Please enter a valid email address." },
        400
      );
    }

    if (!turnstileToken) {
      return jsonResponse(
        { success: false, message: "Please complete the security check before submitting." },
        400
      );
    }

    const turnstileCheck = await verifyTurnstileToken(
      turnstileToken,
      clientIp,
      turnstileSecretKey
    );

    if (!turnstileCheck.success) {
      return jsonResponse(
        { success: false, message: "Security check failed. Please refresh and try again." },
        400
      );
    }

    const submissionRateLimitResponse = await enforceRateLimit(
      supabaseAdmin,
      buildRateLimitKey("submission", rateLimitIdentityHash),
      SUBMISSION_RATE_LIMIT_WINDOW_SECONDS,
      SUBMISSION_RATE_LIMIT_MAX_REQUESTS,
      "Too many sign-ups from this connection recently. Please try again in a few minutes."
    );

    if (submissionRateLimitResponse) {
      return submissionRateLimitResponse;
    }

    const dailySubmissionRateLimitResponse = await enforceRateLimit(
      supabaseAdmin,
      buildRateLimitKey("submission-daily", rateLimitIdentityHash),
      DAILY_SUBMISSION_RATE_LIMIT_WINDOW_SECONDS,
      DAILY_SUBMISSION_RATE_LIMIT_MAX_REQUESTS,
      "Too many sign-ups from this connection today. Please try again tomorrow."
    );

    if (dailySubmissionRateLimitResponse) {
      return dailySubmissionRateLimitResponse;
    }

    const storedName = makeStorageSafeText(name);
    const storedCompany = makeStorageSafeText(company);
    const storedPosition = makeStorageSafeText(position);
    const storedEventName = makeStorageSafeText(eventName);
    const storedSourcePage = makeStorageSafeText(sourcePage);
    const storedUserAgent = makeStorageSafeText(userAgent);

    const rawPayload = {
      name,
      email,
      phone,
      original_phone: rawPhone,
      company,
      position,
      event_name: eventName,
      source_page: storedSourcePage,
      user_agent: storedUserAgent
    };

    const { data: insertedLead, error: insertError } = await supabaseAdmin
      .from("event_leads")
      .insert({
        name: storedName,
        email,
        phone,
        normalized_phone: phone,
        company: storedCompany,
        position: storedPosition,
        event_name: storedEventName,
        source_page: storedSourcePage || null,
        user_agent: storedUserAgent || null,
        raw_payload: rawPayload
      })
      .select("id")
      .single();

    if (insertError || !insertedLead) {
      console.error("Failed to insert event lead:", insertError);

      return jsonResponse(
        { success: false, message: "We couldn't save your info right now. Please try again." },
        500
      );
    }

    return jsonResponse({
      success: true,
      message: successMessage,
      lead_id: insertedLead.id
    });
  } catch (error) {
    console.error("Unexpected event lead submission error:", error);

    return jsonResponse(
      { success: false, message: "We couldn't process your info right now. Please try again." },
      500
    );
  }
});
