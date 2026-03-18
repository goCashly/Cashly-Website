document.addEventListener("DOMContentLoaded", () => {
  const callbackForm = document.getElementById("homeCallbackForm");
  const callbackMessage = document.getElementById("homeCallbackMessage");
  const callbackSubmitButton = document.getElementById("homeCallbackSubmitButton");
  const callbackTurnstileContainer = document.getElementById("homeCallbackTurnstile");
  const defaultCallbackButtonText = callbackSubmitButton ? callbackSubmitButton.textContent.trim() : "Submit";
  let callbackTurnstileWidgetId = null;
  let callbackTurnstileToken = "";
  let callbackTurnstileReady = false;
  const calculatorModal = document.getElementById("borrowerCalculatorModal");
  const calculatorForm = document.getElementById("mortgageCalculatorForm");
  const calculatorNextButton = document.getElementById("calculatorNextButton");
  const calculatorLeadForm = document.getElementById("calculatorLeadForm");
  const calculatorLeadMessage = document.getElementById("calculatorLeadMessage");
  const calculatorLeadSubmitButton = document.getElementById("calculatorLeadSubmitButton");
  const calculatorBackButton = document.getElementById("calculatorBackButton");
  const calculatorLeadFirstName = document.getElementById("calculator-lead-first-name");
  const calculatorLeadLockedState = document.getElementById("calculatorLeadLockedState");
  const calculatorLeadModal = document.getElementById("calculatorLeadModal");
  const calculatorLeadTurnstileContainer = document.getElementById("calculatorLeadTurnstile");
  const calculatorResultModal = document.getElementById("calculatorResultModal");
  const calculatorResultDate = document.getElementById("calculator-result-date");
  const calculatorDownloadPdfButton = document.getElementById("calculatorDownloadPdfButton");
  const calculatorResultEmailNotice = document.getElementById("calculatorResultEmailNotice");
  const defaultCalculatorLeadButtonText = calculatorLeadSubmitButton ? calculatorLeadSubmitButton.textContent.trim() : "Unlock My Estimate";
  let calculatorLeadTurnstileWidgetId = null;
  let calculatorLeadTurnstileToken = "";
  let calculatorLeadTurnstileReady = false;
  let calculatorTransitioningToLeadModal = false;
  let calculatorReopenAfterLeadModal = false;
  let calculatorOpenResultAfterLeadModal = false;
  let calculatorEstimateEmailSent = false;
  let calculatorEstimateEmailAddress = "";

  if (window.AOS) {
    window.AOS.init({
      duration: 900,
      once: true
    });
  }

  const mobileNavMediaQuery = window.matchMedia("(max-width: 991px)");
  const navDropdowns = Array.from(document.querySelectorAll(".main-nav .dropdown"));

  if (navDropdowns.length > 0) {
    const closeDropdown = (dropdown) => {
      const toggle = dropdown.querySelector(".dropdown-toggle");
      const menu = dropdown.querySelector(".dropdown-menu");

      dropdown.classList.remove("is-open");

      if (menu) {
        menu.classList.remove("show");
      }

      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
      }
    };

    const closeAllDropdowns = () => {
      navDropdowns.forEach(closeDropdown);
    };

    navDropdowns.forEach((dropdown) => {
      const toggle = dropdown.querySelector(".dropdown-toggle");
      const menu = dropdown.querySelector(".dropdown-menu");

      if (!toggle || !menu) {
        return;
      }

      toggle.addEventListener("click", (event) => {
        if (!mobileNavMediaQuery.matches) {
          return;
        }

        event.preventDefault();

        const willOpen = !dropdown.classList.contains("is-open");

        closeAllDropdowns();

        if (willOpen) {
          dropdown.classList.add("is-open");
          menu.classList.add("show");
          toggle.setAttribute("aria-expanded", "true");
        }
      });
    });

    document.addEventListener("click", (event) => {
      if (!mobileNavMediaQuery.matches) {
        return;
      }

      if (!event.target.closest(".main-nav .dropdown")) {
        closeAllDropdowns();
      }
    });

    const resetDropdowns = () => {
      if (!mobileNavMediaQuery.matches) {
        closeAllDropdowns();
      }
    };

    if (typeof mobileNavMediaQuery.addEventListener === "function") {
      mobileNavMediaQuery.addEventListener("change", resetDropdowns);
    } else if (typeof mobileNavMediaQuery.addListener === "function") {
      mobileNavMediaQuery.addListener(resetDropdowns);
    }
  }

  const calculatorInputs = {
    property: document.getElementById("calculator-property"),
    downPayment: document.getElementById("calculator-down-payment"),
    rate: document.getElementById("calculator-rate"),
    years: document.getElementById("calculator-years")
  };
  const calculatorOutputs = {
    monthly: document.getElementById("calculator-monthly"),
    loan: document.getElementById("calculator-loan"),
    interest: document.getElementById("calculator-interest"),
    years: document.getElementById("calculator-summary-years"),
    ltv: document.getElementById("calculator-ltv")
  };

  if (
    calculatorInputs.property &&
    calculatorInputs.downPayment &&
    calculatorInputs.rate &&
    calculatorInputs.years &&
    calculatorOutputs.monthly &&
    calculatorOutputs.loan &&
    calculatorOutputs.interest &&
    calculatorOutputs.years &&
    calculatorOutputs.ltv
  ) {
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

    const getInputValue = (input) => {
      const parsed = Number.parseFloat(input.value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const calculateMortgageEstimate = () => {
      const propertyValue = Math.max(getInputValue(calculatorInputs.property), 0);
      const downPayment = Math.max(getInputValue(calculatorInputs.downPayment), 0);
      const annualRate = Math.max(getInputValue(calculatorInputs.rate), 0);
      const years = Math.max(getInputValue(calculatorInputs.years), 1);
      const loanAmount = Math.max(propertyValue - downPayment, 0);
      const totalMonths = Math.max(Math.round(years * 12), 1);
      const monthlyRate = annualRate / 100 / 12;

      let monthlyPayment = 0;

      if (loanAmount > 0) {
        if (monthlyRate > 0) {
          const growthFactor = Math.pow(1 + monthlyRate, totalMonths);
          monthlyPayment = loanAmount * ((monthlyRate * growthFactor) / (growthFactor - 1));
        } else {
          monthlyPayment = loanAmount / totalMonths;
        }
      }

      const totalInterest = Math.max(monthlyPayment * totalMonths - loanAmount, 0);
      const loanToValue = propertyValue > 0 ? (loanAmount / propertyValue) * 100 : 0;

      return {
        propertyValue,
        downPayment,
        annualRate,
        years,
        loanAmount,
        monthlyPayment,
        totalInterest,
        loanToValue
      };
    };

    const updateCalculator = () => {
      const estimate = calculateMortgageEstimate();

      calculatorOutputs.monthly.textContent = currencyFormatter.format(estimate.monthlyPayment);
      calculatorOutputs.loan.textContent = currencyFormatter.format(estimate.loanAmount);
      calculatorOutputs.interest.textContent = currencyFormatter.format(estimate.totalInterest);
      calculatorOutputs.years.textContent = `${Math.round(estimate.years)} years`;
      calculatorOutputs.ltv.textContent = `${percentageFormatter.format(estimate.loanToValue)}%`;
    };

    const updateCalculatorResultDate = () => {
      if (!calculatorResultDate) {
        return;
      }

      calculatorResultDate.textContent = dateFormatter.format(new Date());
    };

    const buildCalculatorEstimatePayload = () => {
      const estimate = calculateMortgageEstimate();

      return {
        property_value: estimate.propertyValue,
        down_payment: estimate.downPayment,
        interest_rate: estimate.annualRate,
        amortization_years: Math.round(estimate.years),
        loan_amount: estimate.loanAmount,
        monthly_payment: estimate.monthlyPayment,
        total_interest: estimate.totalInterest,
        loan_to_value: estimate.loanToValue
      };
    };

    const buildCalculatorLeadMessage = () => {
      const estimate = buildCalculatorEstimatePayload();

      return [
        "Calculator lead request",
        `Property value: ${currencyFormatter.format(estimate.property_value)}`,
        `Down payment: ${currencyFormatter.format(estimate.down_payment)}`,
        `Interest rate: ${percentageFormatter.format(estimate.interest_rate)}%`,
        `Amortization: ${Math.round(estimate.amortization_years)} years`,
        `Estimated monthly payment: ${currencyFormatter.format(estimate.monthly_payment)}`,
        `Estimated loan amount: ${currencyFormatter.format(estimate.loan_amount)}`,
        `Estimated total interest: ${currencyFormatter.format(estimate.total_interest)}`,
        `Estimated loan-to-value: ${percentageFormatter.format(estimate.loan_to_value)}%`
      ].join("\n");
    };

    const updateCalculatorResultEmailNotice = () => {
      if (!calculatorResultEmailNotice) {
        return;
      }

      if (!calculatorEstimateEmailSent || !calculatorEstimateEmailAddress) {
        calculatorResultEmailNotice.hidden = true;
        calculatorResultEmailNotice.textContent = "";
        return;
      }

      calculatorResultEmailNotice.hidden = false;
      calculatorResultEmailNotice.textContent = `A copy of this estimate has been emailed to ${calculatorEstimateEmailAddress}.`;
    };

    const escapeHtml = (value) => {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };

    const buildCalculatorResultPdfMarkup = () => {
      const estimate = buildCalculatorEstimatePayload();
      const logoUrl = new URL("images/cashly-logo-nav.png", window.location.href).href;

      return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cashly Payment Plan</title>
  <style>
    body {
      background: #f3f8ff;
      color: #13233a;
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 28px;
    }

    .sheet {
      background: #ffffff;
      border: 1px solid rgba(19, 35, 58, 0.08);
      border-radius: 28px;
      box-shadow: 0 20px 50px rgba(20, 44, 85, 0.12);
      margin: 0 auto;
      max-width: 860px;
      overflow: hidden;
    }

    .hero {
      background: linear-gradient(180deg, #ffffff 0%, #f4f8ff 100%);
      padding: 30px;
    }

    .hero-top {
      align-items: flex-start;
      display: flex;
      gap: 20px;
    }

    .hero-top img {
      display: block;
      max-width: 150px;
      width: 100%;
    }

    .kicker {
      color: #4d6fc4;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    h1 {
      font-size: 34px;
      line-height: 1.08;
      margin: 12px 0 10px;
    }

    .hero p,
    .footer p {
      color: #5b6b81;
      font-size: 14px;
      line-height: 1.7;
      margin: 0;
    }

    .meta {
      background: #eef5ff;
      border-radius: 18px;
      color: #50637b;
      display: flex;
      font-size: 13px;
      font-weight: 700;
      justify-content: space-between;
      margin-top: 20px;
      padding: 14px 18px;
    }

    .body {
      padding: 0 30px 30px;
    }

    .highlight {
      background: linear-gradient(180deg, #1f4fb9 0%, #163a87 100%);
      border-radius: 24px;
      color: #ffffff;
      margin-top: -8px;
      padding: 28px;
    }

    .eyebrow {
      display: block;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      margin-bottom: 10px;
      text-transform: uppercase;
    }

    .highlight strong {
      display: block;
      font-size: 42px;
      line-height: 1;
      margin-bottom: 12px;
    }

    .highlight p {
      color: rgba(255, 255, 255, 0.84);
      font-size: 14px;
      line-height: 1.7;
      margin: 0;
    }

    .grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 22px;
    }

    .card {
      background: #f8fbff;
      border: 1px solid rgba(36, 89, 211, 0.08);
      border-radius: 20px;
      padding: 18px;
    }

    .card strong {
      display: block;
      font-size: 22px;
      line-height: 1.25;
    }

    .footer {
      border-top: 1px solid rgba(19, 35, 58, 0.08);
      margin-top: 24px;
      padding-top: 18px;
    }

    .footer a {
      color: #2459d3;
      text-decoration: none;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }

      .sheet {
        border: 0;
        border-radius: 0;
        box-shadow: none;
        max-width: none;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hero">
      <div class="hero-top">
        <img src="${escapeHtml(logoUrl)}" alt="Cashly logo">
        <div>
          <span class="kicker">Your Estimate</span>
          <h1>Your mortgage payment plan is ready.</h1>
          <p>Use this as a starting point, then book a free review if you want help comparing realistic next steps.</p>
        </div>
      </div>
      <div class="meta">
        <span>Prepared by Cashly</span>
        <span>${escapeHtml(dateFormatter.format(new Date()))}</span>
      </div>
    </div>

    <div class="body">
      <div class="highlight">
        <span class="eyebrow">Estimated monthly payment</span>
        <strong>${escapeHtml(currencyFormatter.format(estimate.monthly_payment))}</strong>
        <p>Based on the property value, down payment, rate, and amortization entered.</p>
      </div>

      <div class="grid">
        <div class="card">
          <span class="eyebrow">Estimated loan amount</span>
          <strong>${escapeHtml(currencyFormatter.format(estimate.loan_amount))}</strong>
        </div>
        <div class="card">
          <span class="eyebrow">Estimated total interest</span>
          <strong>${escapeHtml(currencyFormatter.format(estimate.total_interest))}</strong>
        </div>
        <div class="card">
          <span class="eyebrow">Amortization period</span>
          <strong>${escapeHtml(`${Math.round(estimate.amortization_years)} years`)}</strong>
        </div>
        <div class="card">
          <span class="eyebrow">Estimated loan-to-value</span>
          <strong>${escapeHtml(`${percentageFormatter.format(estimate.loan_to_value)}%`)}</strong>
        </div>
      </div>

      <div class="footer">
        <p>This estimate is for planning purposes only and does not include taxes, insurance, lender fees, or legal costs.</p>
        <p>Contact Cashly at <a href="mailto:operations@gocashly.io">operations@gocashly.io</a> or <a href="tel:+12184133596">+1 218-413-3596</a>.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
    };

    const downloadCalculatorResultPdf = () => {
      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        window.alert("Please allow pop-ups so you can download your payment plan as a PDF.");
        return;
      }

      let hasPrinted = false;
      const startPrint = () => {
        if (hasPrinted) {
          return;
        }

        hasPrinted = true;
        printWindow.focus();
        printWindow.print();
      };

      printWindow.document.open();
      printWindow.document.write(buildCalculatorResultPdfMarkup());
      printWindow.document.close();
      printWindow.document.title = "Cashly Payment Plan";
      printWindow.onload = () => {
        window.setTimeout(startPrint, 250);
      };
      printWindow.onafterprint = () => {
        printWindow.close();
      };
      window.setTimeout(startPrint, 1200);
    };

    const openCalculatorResultModal = () => {
      updateCalculator();
      updateCalculatorResultDate();
      updateCalculatorResultEmailNotice();

      if (window.jQuery && calculatorResultModal) {
        window.jQuery(calculatorResultModal).modal("show");
      }
    };

    Object.values(calculatorInputs).forEach((input) => {
      input.addEventListener("input", updateCalculator);
      input.addEventListener("change", updateCalculator);
    });

    updateCalculator();
    updateCalculatorResultDate();

    const setStatusMessage = (element, type, text) => {
      if (!element) {
        return;
      }

      element.className = "callback-message";

      if (type === "success") {
        element.classList.add("is-success");
      }

      if (type === "error") {
        element.classList.add("is-error");
      }

      element.textContent = text;
    };

    const openCalculatorLeadStep = () => {
      if (!window.jQuery || !calculatorModal || !calculatorLeadModal) {
        return;
      }

      calculatorReopenAfterLeadModal = false;
      calculatorOpenResultAfterLeadModal = false;
      calculatorTransitioningToLeadModal = true;
      window.jQuery(calculatorModal).modal("hide");
    };

    const closeCalculatorLeadStep = () => {
      if (window.jQuery && calculatorLeadModal) {
        calculatorOpenResultAfterLeadModal = false;
        calculatorReopenAfterLeadModal = true;
        window.jQuery(calculatorLeadModal).modal("hide");
      }
    };

    const resetCalculatorLeadTurnstile = () => {
      calculatorLeadTurnstileToken = "";

      if (window.turnstile && calculatorLeadTurnstileWidgetId !== null) {
        window.turnstile.reset(calculatorLeadTurnstileWidgetId);
        calculatorLeadTurnstileReady = true;
        return;
      }

      calculatorLeadTurnstileReady = false;
    };

    const resetCalculatorLeadCapture = () => {
      if (calculatorLeadForm) {
        calculatorLeadForm.reset();
      }

      setStatusMessage(calculatorLeadMessage, "", "");
      resetCalculatorLeadTurnstile();
    };

    const resetCalculatorLeadFlow = () => {
      if (calculatorLeadLockedState) {
        calculatorLeadLockedState.hidden = false;
      }

      calculatorTransitioningToLeadModal = false;
      calculatorReopenAfterLeadModal = false;
      calculatorOpenResultAfterLeadModal = false;
      resetCalculatorLeadCapture();
    };

    const renderCalculatorLeadTurnstile = async () => {
      if (!calculatorLeadTurnstileContainer) {
        return;
      }

      const callbackConfig = getCallbackFormConfig();

      if (!callbackConfig || calculatorLeadTurnstileWidgetId !== null) {
        return;
      }

      try {
        const turnstile = await waitForTurnstileApi();

        calculatorLeadTurnstileWidgetId = turnstile.render(calculatorLeadTurnstileContainer, {
          sitekey: callbackConfig.turnstileSiteKey,
          theme: "light",
          callback(token) {
            calculatorLeadTurnstileToken = token;
            calculatorLeadTurnstileReady = true;
          },
          "expired-callback"() {
            calculatorLeadTurnstileToken = "";
          },
          "timeout-callback"() {
            calculatorLeadTurnstileToken = "";
          },
          "error-callback"(errorCode) {
            calculatorLeadTurnstileToken = "";
            calculatorLeadTurnstileReady = false;
            console.error("Calculator Turnstile error:", errorCode);
            setStatusMessage(
              calculatorLeadMessage,
              "error",
              `The security check could not load. Refresh the page and try again.${errorCode ? ` Error code: ${errorCode}.` : ""}`
            );
            return true;
          }
        });

        calculatorLeadTurnstileReady = true;
      } catch (error) {
        calculatorLeadTurnstileReady = false;
        setStatusMessage(calculatorLeadMessage, "error", "The security check could not load. Refresh the page and try again.");
      }
    };

    if (calculatorNextButton && calculatorForm) {
      calculatorNextButton.addEventListener("click", () => {
        if (!calculatorForm.reportValidity()) {
          return;
        }

        openCalculatorLeadStep();
      });
    }

    if (calculatorBackButton) {
      calculatorBackButton.addEventListener("click", () => {
        closeCalculatorLeadStep();
      });
    }

    if (calculatorLeadForm && calculatorLeadMessage && calculatorLeadSubmitButton) {
      calculatorLeadForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(calculatorLeadForm);
        const payload = {
          first_name: getTrimmedFormValue(formData, "first_name"),
          last_name: getTrimmedFormValue(formData, "last_name"),
          email: getTrimmedFormValue(formData, "email"),
          phone: getTrimmedFormValue(formData, "phone"),
          message: buildCalculatorLeadMessage(),
          estimate: buildCalculatorEstimatePayload(),
          company_name: getTrimmedFormValue(formData, "company_name"),
          source_page: `${window.location.pathname}#calculator-estimate`,
          turnstile_token: calculatorLeadTurnstileToken
        };

        if (!payload.first_name || !payload.last_name || !payload.email || !payload.phone) {
          setStatusMessage(calculatorLeadMessage, "error", "Please fill in the required fields before submitting.");
          return;
        }

        if (!getCallbackFormConfig()) {
          setStatusMessage(
            calculatorLeadMessage,
            "error",
            "Calculator form is not configured yet. Add the Edge Function endpoint and Turnstile site key in js/cashly-config.js."
          );
          return;
        }

        if (!calculatorLeadTurnstileReady) {
          setStatusMessage(calculatorLeadMessage, "error", "The security check is still loading. Please wait a moment and try again.");
          return;
        }

        if (!payload.turnstile_token) {
          setStatusMessage(calculatorLeadMessage, "error", "Please complete the security check before submitting.");
          return;
        }

        calculatorLeadSubmitButton.disabled = true;
        calculatorLeadSubmitButton.textContent = "Unlocking";
        calculatorEstimateEmailSent = false;
        calculatorEstimateEmailAddress = "";
        updateCalculatorResultEmailNotice();
        setStatusMessage(calculatorLeadMessage, "", "");

        try {
          const responsePayload = await submitCallbackToEdgeFunction(payload);
          calculatorEstimateEmailSent = responsePayload && responsePayload.estimate_email_sent === true;
          calculatorEstimateEmailAddress = calculatorEstimateEmailSent ? payload.email : "";
          updateCalculatorResultEmailNotice();
          resetCalculatorLeadCapture();

          if (window.jQuery && calculatorLeadModal) {
            calculatorReopenAfterLeadModal = false;
            calculatorOpenResultAfterLeadModal = true;
            window.jQuery(calculatorLeadModal).modal("hide");
          }
        } catch (error) {
          resetCalculatorLeadTurnstile();
          setStatusMessage(calculatorLeadMessage, "error", error.message || "Network error. Please try again in a moment.");
        } finally {
          calculatorLeadSubmitButton.disabled = false;
          calculatorLeadSubmitButton.textContent = defaultCalculatorLeadButtonText;
        }
      });
    }

    if (window.jQuery && calculatorModal && calculatorInputs.property) {
      window.jQuery(calculatorModal).on("shown.bs.modal", () => {
        calculatorInputs.property.focus();
        calculatorInputs.property.select();
      });

      window.jQuery(calculatorModal).on("hidden.bs.modal", () => {
        if (calculatorTransitioningToLeadModal && calculatorLeadModal) {
          calculatorTransitioningToLeadModal = false;
          window.jQuery(calculatorLeadModal).modal("show");
          return;
        }

        resetCalculatorLeadFlow();
      });
    }

    if (window.jQuery && calculatorLeadModal) {
      window.jQuery(calculatorLeadModal).on("shown.bs.modal", () => {
        if (!calculatorLeadTurnstileWidgetId) {
          renderCalculatorLeadTurnstile();
        }

        if (calculatorLeadFirstName) {
          calculatorLeadFirstName.focus();
        }
      });

      window.jQuery(calculatorLeadModal).on("hidden.bs.modal", () => {
        resetCalculatorLeadCapture();

        if (calculatorOpenResultAfterLeadModal) {
          calculatorOpenResultAfterLeadModal = false;
          openCalculatorResultModal();
          return;
        }

        if (calculatorReopenAfterLeadModal && calculatorModal) {
          calculatorReopenAfterLeadModal = false;
          window.jQuery(calculatorModal).modal("show");
        }
      });
    }

    if (window.jQuery && calculatorResultModal) {
      window.jQuery(calculatorResultModal).on("shown.bs.modal", () => {
        updateCalculator();
        updateCalculatorResultDate();
        updateCalculatorResultEmailNotice();
      });
    }

    if (calculatorDownloadPdfButton) {
      calculatorDownloadPdfButton.addEventListener("click", downloadCalculatorResultPdf);
    }
  }

  const setStatusMessage = (element, type, text) => {
    if (!element) {
      return;
    }

    element.className = "callback-message";

    if (type === "success") {
      element.classList.add("is-success");
    }

    if (type === "error") {
      element.classList.add("is-error");
    }

    element.textContent = text;
  };

  const setCallbackMessage = (type, text) => {
    setStatusMessage(callbackMessage, type, text);
  };

  const getTrimmedFormValue = (formData, fieldName) => {
    return (formData.get(fieldName) || "").toString().trim();
  };

  const callbackSubmitMode = callbackForm ? callbackForm.dataset.submitMode || "edge-function" : "edge-function";

  const getCallbackFormConfig = () => {
    const config = window.CASHLY_CONFIG && window.CASHLY_CONFIG.callbackForm;

    if (!config || !config.endpoint || !config.turnstileSiteKey) {
      return null;
    }

    return {
      endpoint: config.endpoint,
      turnstileSiteKey: config.turnstileSiteKey
    };
  };

  const waitForTurnstileApi = (timeoutMs = 10000) => {
    return new Promise((resolve, reject) => {
      if (window.turnstile && typeof window.turnstile.render === "function") {
        resolve(window.turnstile);
        return;
      }

      const startedAt = Date.now();
      const intervalId = window.setInterval(() => {
        if (window.turnstile && typeof window.turnstile.render === "function") {
          window.clearInterval(intervalId);
          resolve(window.turnstile);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          window.clearInterval(intervalId);
          reject(new Error("Turnstile failed to load."));
        }
      }, 100);
    });
  };

  const resetCallbackTurnstile = () => {
    callbackTurnstileToken = "";

    if (window.turnstile && callbackTurnstileWidgetId !== null) {
      window.turnstile.reset(callbackTurnstileWidgetId);
    }
  };

  const renderCallbackTurnstile = async () => {
    if (!callbackForm || !callbackTurnstileContainer) {
      return;
    }

    const callbackConfig = getCallbackFormConfig();

    if (!callbackConfig || callbackTurnstileWidgetId !== null) {
      return;
    }

    try {
      const turnstile = await waitForTurnstileApi();

      callbackTurnstileWidgetId = turnstile.render(callbackTurnstileContainer, {
        sitekey: callbackConfig.turnstileSiteKey,
        theme: "light",
        callback(token) {
          callbackTurnstileToken = token;
          callbackTurnstileReady = true;
        },
        "expired-callback"() {
          callbackTurnstileToken = "";
        },
        "timeout-callback"() {
          callbackTurnstileToken = "";
        },
        "error-callback"(errorCode) {
          callbackTurnstileToken = "";
          callbackTurnstileReady = false;
          console.error("Turnstile error:", errorCode);
          setCallbackMessage(
            "error",
            `The security check could not load. Refresh the page and try again.${errorCode ? ` Error code: ${errorCode}.` : ""}`
          );
          return true;
        }
      });

      callbackTurnstileReady = true;
    } catch (error) {
      callbackTurnstileReady = false;
      setCallbackMessage("error", "The security check could not load. Refresh the page and try again.");
    }
  };

  const submitCallbackToEdgeFunction = async (payload) => {
    const callbackConfig = getCallbackFormConfig();

    if (!callbackConfig) {
      throw new Error("Callback form is not configured.");
    }

    const response = await fetch(callbackConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    let responsePayload = null;

    try {
      responsePayload = await response.json();
    } catch (error) {
      responsePayload = null;
    }

    if (!response.ok || !responsePayload || responsePayload.success !== true) {
      const errorMessage = responsePayload && responsePayload.message
        ? responsePayload.message
        : "Something went wrong while saving your request.";

      throw new Error(errorMessage);
    }

    return responsePayload;
  };

  if (callbackForm && callbackMessage && callbackSubmitButton) {
    renderCallbackTurnstile();

    callbackForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(callbackForm);
      const payload = {
        first_name: getTrimmedFormValue(formData, "first_name"),
        last_name: getTrimmedFormValue(formData, "last_name"),
        email: getTrimmedFormValue(formData, "email"),
        phone: getTrimmedFormValue(formData, "phone"),
        message: getTrimmedFormValue(formData, "message"),
        company_name: getTrimmedFormValue(formData, "company_name"),
        source_page: window.location.pathname,
        turnstile_token: callbackTurnstileToken
      };

      if (!payload.first_name || !payload.last_name || !payload.email || !payload.phone || !payload.message) {
        setCallbackMessage("error", "Please fill in the required fields before submitting.");
        return;
      }

      if (callbackSubmitMode !== "edge-function") {
        setCallbackMessage("error", "This callback form is not configured with a supported submit mode.");
        return;
      }

      if (!getCallbackFormConfig()) {
        setCallbackMessage(
          "error",
          "Callback form is not configured yet. Add the Edge Function endpoint and Turnstile site key in js/cashly-config.js."
        );
        return;
      }

      if (!callbackTurnstileReady) {
        setCallbackMessage("error", "The security check is still loading. Please wait a moment and try again.");
        return;
      }

      if (!payload.turnstile_token) {
        setCallbackMessage("error", "Please complete the security check before submitting.");
        return;
      }

      callbackSubmitButton.disabled = true;
      callbackSubmitButton.textContent = "Sending";
      setCallbackMessage("", "");

      try {
        const responsePayload = await submitCallbackToEdgeFunction(payload);
        callbackForm.reset();
        resetCallbackTurnstile();
        setCallbackMessage(
          "success",
          responsePayload && responsePayload.request_id
            ? `Message sent successfully. Request ID: ${responsePayload.request_id}`
            : "Message sent successfully. We’ll be in touch soon."
        );
      } catch (error) {
        resetCallbackTurnstile();
        setCallbackMessage("error", error.message || "Network error. Please try again in a moment.");
      } finally {
        callbackSubmitButton.disabled = false;
        callbackSubmitButton.textContent = defaultCallbackButtonText;
      }
    });
  }

  const scrollButton = document.querySelector(".scroll-top-to");

  if (scrollButton) {
    const updateScrollButton = () => {
      if (window.scrollY > 200) {
        scrollButton.classList.add("active");
      } else {
        scrollButton.classList.remove("active");
      }
    };

    const scrollToTop = () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    };

    window.addEventListener("scroll", updateScrollButton, { passive: true });
    scrollButton.addEventListener("click", scrollToTop);
    scrollButton.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        scrollToTop();
      }
    });

    updateScrollButton();
  }
});
