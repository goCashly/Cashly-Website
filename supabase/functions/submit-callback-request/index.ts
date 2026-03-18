import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

const MAX_LENGTHS = {
  firstName: 100,
  lastName: 100,
  email: 255,
  phone: 40,
  message: 5000,
  sourcePage: 255,
  companyName: 100,
  notes: 5000
};

const successMessage = "Message sent successfully. We’ll be in touch soon.";
const rateLimitUnavailableMessage = "We can’t accept callback requests right now. Please try again shortly.";
const ATTEMPT_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const ATTEMPT_RATE_LIMIT_MAX_REQUESTS = 10;
const SUBMISSION_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const SUBMISSION_RATE_LIMIT_MAX_REQUESTS = 5;
const DAILY_SUBMISSION_RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;
const DAILY_SUBMISSION_RATE_LIMIT_MAX_REQUESTS = 12;
const RATE_LIMIT_ERROR_RETRY_AFTER_SECONDS = 60;
const STORAGE_SAFE_CHARACTER_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
};
const DEFAULT_ESTIMATE_EMAIL_FROM = "Cashly <operations@gocashly.io>";
const currencyFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0
});
const percentageFormatter = new Intl.NumberFormat("en-CA", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  month: "long",
  day: "numeric",
  year: "numeric"
});

type EstimatePayload = {
  propertyValue: number;
  downPayment: number;
  annualRate: number;
  years: number;
  loanAmount: number;
  monthlyPayment: number;
  totalInterest: number;
  loanToValue: number;
};

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
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[&<>"']/g, (character) => STORAGE_SAFE_CHARACTER_MAP[character] || character);
};

const getNumberValue = (
  value: unknown,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER
) => {
  const parsedValue = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number.parseFloat(value)
      : Number.NaN;

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.min(Math.max(parsedValue, minimum), maximum);
};

const getEstimatePayload = (value: unknown): EstimatePayload | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const estimate = {
    propertyValue: getNumberValue(input.property_value),
    downPayment: getNumberValue(input.down_payment),
    annualRate: getNumberValue(input.interest_rate, 0, 100),
    years: getNumberValue(input.amortization_years, 1, 50),
    loanAmount: getNumberValue(input.loan_amount),
    monthlyPayment: getNumberValue(input.monthly_payment),
    totalInterest: getNumberValue(input.total_interest),
    loanToValue: getNumberValue(input.loan_to_value, 0, 100)
  };

  if (estimate.propertyValue <= 0 || estimate.years <= 0) {
    return null;
  }

  return estimate;
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

const buildEstimateEmailHtml = ({
  firstName,
  estimate
}: {
  firstName: string,
  estimate: EstimatePayload
}) => {
  const safeFirstName = makeStorageSafeText(firstName || "there");
  const preparedDate = makeStorageSafeText(dateFormatter.format(new Date()));

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f3f8ff;color:#13233a;font-family:Arial,sans-serif;">
    <div style="margin:0 auto;max-width:720px;padding:24px;">
      <div style="background:#ffffff;border:1px solid rgba(19,35,58,0.08);border-radius:28px;overflow:hidden;box-shadow:0 18px 50px rgba(20,44,85,0.12);">
        <div style="background:linear-gradient(180deg,#ffffff 0%,#f4f8ff 100%);padding:32px 32px 24px;">
          <div style="color:#4d6fc4;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Cashly Estimate</div>
          <h1 style="font-size:32px;line-height:1.1;margin:12px 0 10px;">Your mortgage payment plan is ready.</h1>
          <p style="color:#5b6b81;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${safeFirstName}, here is your private mortgage estimate from Cashly. Use this as a starting point, then book a free review if you want help comparing realistic next steps.</p>
          <div style="background:#eef5ff;border-radius:18px;color:#50637b;font-size:13px;font-weight:700;padding:14px 18px;">Prepared by Cashly on ${preparedDate}</div>
        </div>

        <div style="padding:0 32px 32px;">
          <div style="background:linear-gradient(180deg,#1f4fb9 0%,#163a87 100%);border-radius:24px;color:#ffffff;margin-top:-6px;padding:28px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;margin-bottom:12px;text-transform:uppercase;">Estimated monthly payment</div>
            <div style="font-size:40px;font-weight:700;line-height:1;margin-bottom:12px;">${makeStorageSafeText(currencyFormatter.format(estimate.monthlyPayment))}</div>
            <p style="color:rgba(255,255,255,0.84);font-size:14px;line-height:1.7;margin:0;">Based on the property value, down payment, rate, and amortization entered.</p>
          </div>

          <div style="margin-top:24px;">
            <h2 style="font-size:18px;margin:0 0 14px;">Estimate summary</h2>
            <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 12px;">
              <tr>
                <td style="width:50%;padding-right:6px;vertical-align:top;">
                  <div style="background:#f8fbff;border:1px solid rgba(36,89,211,0.08);border-radius:20px;padding:18px;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;margin-bottom:10px;text-transform:uppercase;">Estimated loan amount</div>
                    <div style="font-size:22px;font-weight:700;">${makeStorageSafeText(currencyFormatter.format(estimate.loanAmount))}</div>
                  </div>
                </td>
                <td style="width:50%;padding-left:6px;vertical-align:top;">
                  <div style="background:#f8fbff;border:1px solid rgba(36,89,211,0.08);border-radius:20px;padding:18px;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;margin-bottom:10px;text-transform:uppercase;">Estimated total interest</div>
                    <div style="font-size:22px;font-weight:700;">${makeStorageSafeText(currencyFormatter.format(estimate.totalInterest))}</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="width:50%;padding-right:6px;vertical-align:top;">
                  <div style="background:#f8fbff;border:1px solid rgba(36,89,211,0.08);border-radius:20px;padding:18px;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;margin-bottom:10px;text-transform:uppercase;">Amortization period</div>
                    <div style="font-size:22px;font-weight:700;">${makeStorageSafeText(`${Math.round(estimate.years)} years`)}</div>
                  </div>
                </td>
                <td style="width:50%;padding-left:6px;vertical-align:top;">
                  <div style="background:#f8fbff;border:1px solid rgba(36,89,211,0.08);border-radius:20px;padding:18px;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;margin-bottom:10px;text-transform:uppercase;">Estimated loan-to-value</div>
                    <div style="font-size:22px;font-weight:700;">${makeStorageSafeText(`${percentageFormatter.format(estimate.loanToValue)}%`)}</div>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="margin-top:24px;">
            <h2 style="font-size:18px;margin:0 0 14px;">Your estimate inputs</h2>
            <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 12px;">
              <tr>
                <td style="width:50%;padding-right:6px;vertical-align:top;">
                  <div style="background:#f8fbff;border:1px solid rgba(36,89,211,0.08);border-radius:20px;padding:18px;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;margin-bottom:10px;text-transform:uppercase;">Property value</div>
                    <div style="font-size:22px;font-weight:700;">${makeStorageSafeText(currencyFormatter.format(estimate.propertyValue))}</div>
                  </div>
                </td>
                <td style="width:50%;padding-left:6px;vertical-align:top;">
                  <div style="background:#f8fbff;border:1px solid rgba(36,89,211,0.08);border-radius:20px;padding:18px;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;margin-bottom:10px;text-transform:uppercase;">Down payment</div>
                    <div style="font-size:22px;font-weight:700;">${makeStorageSafeText(currencyFormatter.format(estimate.downPayment))}</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="width:50%;padding-right:6px;vertical-align:top;">
                  <div style="background:#f8fbff;border:1px solid rgba(36,89,211,0.08);border-radius:20px;padding:18px;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;margin-bottom:10px;text-transform:uppercase;">Interest rate</div>
                    <div style="font-size:22px;font-weight:700;">${makeStorageSafeText(`${percentageFormatter.format(estimate.annualRate)}%`)}</div>
                  </div>
                </td>
                <td style="width:50%;padding-left:6px;vertical-align:top;">
                  <div style="background:#f8fbff;border:1px solid rgba(36,89,211,0.08);border-radius:20px;padding:18px;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;margin-bottom:10px;text-transform:uppercase;">Amortization</div>
                    <div style="font-size:22px;font-weight:700;">${makeStorageSafeText(`${Math.round(estimate.years)} years`)}</div>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="background:#f8fbff;border:1px solid rgba(36,89,211,0.08);border-radius:22px;margin-top:24px;padding:20px;">
            <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Want a real quote?</div>
            <p style="color:#5b6b81;font-size:14px;line-height:1.7;margin:0;">Book a free review and we will help you understand likely payments, fees, lender fit, and what a realistic private mortgage path could look like for your situation.</p>
          </div>

          <div style="border-top:1px solid rgba(19,35,58,0.08);margin-top:24px;padding-top:18px;">
            <p style="color:#5b6b81;font-size:14px;line-height:1.7;margin:0 0 8px;">This estimate is for planning purposes only and does not include taxes, insurance, lender fees, or legal costs.</p>
            <p style="color:#5b6b81;font-size:14px;line-height:1.7;margin:0;">Book a review or reply to this email. You can also reach us at <a href="mailto:operations@gocashly.io" style="color:#2459d3;text-decoration:none;">operations@gocashly.io</a> or <a href="tel:+12184133596" style="color:#2459d3;text-decoration:none;">+1 218-413-3596</a>.</p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
};

const buildEstimateEmailText = ({
  firstName,
  estimate
}: {
  firstName: string,
  estimate: EstimatePayload
}) => {
  const greetingName = firstName || "there";

  return [
    `Hi ${greetingName},`,
    "",
    "Your Cashly mortgage payment plan is ready.",
    "",
    `Estimated monthly payment: ${currencyFormatter.format(estimate.monthlyPayment)}`,
    `Estimated loan amount: ${currencyFormatter.format(estimate.loanAmount)}`,
    `Estimated total interest: ${currencyFormatter.format(estimate.totalInterest)}`,
    `Amortization period: ${Math.round(estimate.years)} years`,
    `Estimated loan-to-value: ${percentageFormatter.format(estimate.loanToValue)}%`,
    "",
    "Estimate inputs",
    `Property value: ${currencyFormatter.format(estimate.propertyValue)}`,
    `Down payment: ${currencyFormatter.format(estimate.downPayment)}`,
    `Interest rate: ${percentageFormatter.format(estimate.annualRate)}%`,
    `Amortization: ${Math.round(estimate.years)} years`,
    "",
    "This estimate is for planning purposes only and does not include taxes, insurance, lender fees, or legal costs.",
    "",
    "Book a free review if you want help comparing realistic next steps.",
    "Contact Cashly at operations@gocashly.io or +1 218-413-3596."
  ].join("\n");
};

const sendEstimateEmail = async ({
  resendApiKey,
  fromEmail,
  toEmail,
  requestId,
  firstName,
  estimate
}: {
  resendApiKey: string,
  fromEmail: string,
  toEmail: string,
  requestId: string,
  firstName: string,
  estimate: EstimatePayload
}) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `callback-request-${requestId}-estimate-email`
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: "Your Cashly payment estimate is ready",
      html: buildEstimateEmailHtml({ firstName, estimate }),
      text: buildEstimateEmailText({ firstName, estimate }),
      tags: [
        {
          name: "source",
          value: "calculator-estimate"
        }
      ]
    })
  });

  let responsePayload: Record<string, unknown> | null = null;

  try {
    responsePayload = await response.json();
  } catch (_error) {
    responsePayload = null;
  }

  if (!response.ok || !responsePayload || typeof responsePayload.id !== "string") {
    throw new Error("Estimate email could not be sent.");
  }

  return responsePayload.id;
};

const getRateLimitIdentitySource = ({
  clientIp,
  email,
  phone,
  sourcePage,
  userAgent,
  origin,
  referer
}: {
  clientIp: string,
  email: string,
  phone: string,
  sourcePage: string,
  userAgent: string,
  origin: string,
  referer: string
}) => {
  if (clientIp) {
    return clientIp;
  }

  // Fall back to a coarse request fingerprint when the proxy IP header is missing.
  return [
    email,
    phone,
    sourcePage,
    userAgent,
    origin,
    referer
  ].filter(Boolean).join("|") || "anonymous";
};

const buildRateLimitKey = (bucketName: string, identityHash: string) => {
  return `${bucketName}:${identityHash}`;
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
    console.error("Callback rate limit check failed:", {
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
  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || DEFAULT_ESTIMATE_EMAIL_FROM;

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
  } catch (error) {
    return jsonResponse(
      { success: false, message: "Invalid request body." },
      400
    );
  }

  const firstName = getStringValue(requestBody.first_name, MAX_LENGTHS.firstName);
  const lastName = getStringValue(requestBody.last_name, MAX_LENGTHS.lastName);
  const email = getStringValue(requestBody.email, MAX_LENGTHS.email).toLowerCase();
  const rawPhone = getStringValue(requestBody.phone, MAX_LENGTHS.phone);
  const phone = normalizePhone(rawPhone);
  const message = getStringValue(requestBody.message, MAX_LENGTHS.message);
  const sourcePage = getStringValue(requestBody.source_page, MAX_LENGTHS.sourcePage);
  const companyName = getStringValue(requestBody.company_name, MAX_LENGTHS.companyName);
  const turnstileToken = getStringValue(requestBody.turnstile_token, 2048);
  const estimate = getEstimatePayload(requestBody.estimate);
  const clientIp = getClientIp(request);
  const userAgent = getStringValue(
    request.headers.get("user-agent"),
    MAX_LENGTHS.notes
  );
  const origin = getStringValue(
    request.headers.get("origin"),
    MAX_LENGTHS.sourcePage
  );
  const referer = getStringValue(
    request.headers.get("referer"),
    MAX_LENGTHS.sourcePage
  );

  if (companyName) {
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
      sourcePage,
      userAgent,
      origin,
      referer
    });
    const rateLimitIdentityHash = await sha256Hex(rateLimitIdentitySource);
    const attemptRateLimitResponse = await enforceRateLimit(
      supabaseAdmin,
      buildRateLimitKey("attempt", rateLimitIdentityHash),
      ATTEMPT_RATE_LIMIT_WINDOW_SECONDS,
      ATTEMPT_RATE_LIMIT_MAX_REQUESTS,
      "Too many callback attempts were sent recently. Please wait a few minutes and try again."
    );

    if (attemptRateLimitResponse) {
      return attemptRateLimitResponse;
    }

    if (!firstName || !lastName || !email || !phone || !message) {
      return jsonResponse(
        { success: false, message: "Please fill in the required fields before submitting." },
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
      "Too many callback requests were sent recently. Please try again later."
    );

    if (submissionRateLimitResponse) {
      return submissionRateLimitResponse;
    }

    const dailySubmissionRateLimitResponse = await enforceRateLimit(
      supabaseAdmin,
      buildRateLimitKey("submission-daily", rateLimitIdentityHash),
      DAILY_SUBMISSION_RATE_LIMIT_WINDOW_SECONDS,
      DAILY_SUBMISSION_RATE_LIMIT_MAX_REQUESTS,
      "Too many callback requests were sent today. Please try again tomorrow."
    );

    if (dailySubmissionRateLimitResponse) {
      return dailySubmissionRateLimitResponse;
    }

    const storedMessage = makeStorageSafeText(message);
    const storedSourcePage = makeStorageSafeText(sourcePage);
    const storedUserAgent = makeStorageSafeText(userAgent);

    const rawPayload = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      original_phone: rawPhone,
      message: storedMessage,
      source_page: storedSourcePage,
      user_agent: storedUserAgent,
      estimate
    };

    const { data: insertedRequest, error: insertError } = await supabaseAdmin
      .from("callback_requests")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        normalized_phone: phone,
        message: storedMessage,
        source_page: storedSourcePage || null,
        user_agent: storedUserAgent || null,
        raw_payload: rawPayload
      })
      .select("id")
      .single();

    if (insertError || !insertedRequest) {
      console.error("Failed to insert callback request:", insertError);

      return jsonResponse(
        { success: false, message: "We couldn’t save your request right now. Please try again." },
        500
      );
    }

    let estimateEmailSent = false;
    const isCalculatorEstimateRequest = sourcePage.includes("#calculator-estimate");

    if (isCalculatorEstimateRequest && estimate && resendApiKey) {
      try {
        await sendEstimateEmail({
          resendApiKey,
          fromEmail: resendFromEmail,
          toEmail: email,
          requestId: String(insertedRequest.id),
          firstName,
          estimate
        });
        estimateEmailSent = true;
      } catch (error) {
        console.error("Failed to send calculator estimate email:", {
          requestId: insertedRequest.id,
          error
        });
      }
    }

    return jsonResponse({
      success: true,
      message: successMessage,
      request_id: insertedRequest.id,
      estimate_email_sent: estimateEmailSent
    });
  } catch (error) {
    console.error("Unexpected callback submission error:", error);

    return jsonResponse(
      { success: false, message: "We couldn’t process your request right now. Please try again." },
      500
    );
  }
});
