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
  const calculatorRequestCallbackButton = document.getElementById("calculatorRequestCallbackButton");
  const calculatorResultEmailNotice = document.getElementById("calculatorResultEmailNotice");
  const defaultCalculatorLeadButtonText = calculatorLeadSubmitButton ? calculatorLeadSubmitButton.textContent.trim() : "Unlock My Estimate";
  const calculatorModalHash = "#borrowerCalculatorModal";
  let calculatorLeadTurnstileWidgetId = null;
  let calculatorLeadTurnstileToken = "";
  let calculatorLeadTurnstileReady = false;
  let calculatorLeadTurnstileRenderPromise = null;
  let calculatorTransitioningToLeadModal = false;
  let calculatorReopenAfterLeadModal = false;
  let calculatorOpenResultAfterLeadModal = false;
  let calculatorEstimateEmailSent = false;
  let calculatorEstimateEmailAddress = "";
  let shouldOpenCallbackSectionAfterCalculatorResult = false;

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

    const openCalculatorModalFromHash = () => {
      if (!window.jQuery || !calculatorModal || window.location.hash !== calculatorModalHash) {
        return;
      }

      window.setTimeout(() => {
        window.jQuery(calculatorModal).modal("show");
      }, 0);
    };

    const clearCalculatorModalHash = () => {
      if (window.location.hash !== calculatorModalHash || !window.history.replaceState) {
        return;
      }

      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    };

    const openHomepageCallbackSection = () => {
      const callbackSection = document.getElementById("home-callback");

      if (!callbackSection) {
        return;
      }

      callbackSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      window.setTimeout(() => {
        const firstField = callbackForm && callbackForm.querySelector("input, textarea, select");

        if (!firstField) {
          return;
        }

        firstField.focus();

        if (typeof firstField.select === "function" && firstField.tagName === "INPUT") {
          firstField.select();
        }
      }, 450);
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

    const warmCalculatorLeadTurnstile = () => {
      if (
        !calculatorLeadForm ||
        !calculatorLeadTurnstileContainer ||
        calculatorLeadTurnstileWidgetId !== null ||
        calculatorLeadTurnstileRenderPromise
      ) {
        return;
      }

      renderCalculatorLeadTurnstile();
    };

    const waitForCalculatorLeadTurnstile = async () => {
      if (calculatorLeadTurnstileWidgetId !== null) {
        return;
      }

      await renderCalculatorLeadTurnstile();
    };

    const renderCalculatorLeadTurnstile = async () => {
      if (!calculatorLeadTurnstileContainer) {
        return;
      }

      const callbackConfig = getCallbackFormConfig();

      if (!callbackConfig || calculatorLeadTurnstileWidgetId !== null) {
        return;
      }

      if (calculatorLeadTurnstileRenderPromise) {
        await calculatorLeadTurnstileRenderPromise;
        return;
      }

      calculatorLeadTurnstileReady = false;

      calculatorLeadTurnstileRenderPromise = (async () => {
        try {
          const turnstile = await waitForTurnstileApi();

          if (calculatorLeadTurnstileWidgetId !== null) {
            return;
          }

          calculatorLeadTurnstileWidgetId = turnstile.render(calculatorLeadTurnstileContainer, {
            sitekey: callbackConfig.turnstileSiteKey,
            theme: "light",
            appearance: "always",
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
        } finally {
          calculatorLeadTurnstileRenderPromise = null;
        }
      })();

      await calculatorLeadTurnstileRenderPromise;
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
      const calculatorLeadInteractionFields = calculatorLeadForm.querySelectorAll("input:not([type=\"hidden\"]), textarea, select");

      calculatorLeadInteractionFields.forEach((field) => {
        field.addEventListener("focus", warmCalculatorLeadTurnstile, { once: true });
        field.addEventListener("input", warmCalculatorLeadTurnstile, { once: true });
      });

      calculatorLeadSubmitButton.addEventListener("click", warmCalculatorLeadTurnstile, { passive: true });

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

        if (calculatorLeadTurnstileWidgetId === null) {
          await waitForCalculatorLeadTurnstile();
        }

        payload.turnstile_token = calculatorLeadTurnstileToken;

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
      openCalculatorModalFromHash();

      window.jQuery(calculatorModal).on("shown.bs.modal", () => {
        calculatorInputs.property.focus();
        calculatorInputs.property.select();
      });

      window.jQuery(calculatorModal).on("hidden.bs.modal", () => {
        clearCalculatorModalHash();

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

      window.jQuery(calculatorResultModal).on("hidden.bs.modal", () => {
        if (!shouldOpenCallbackSectionAfterCalculatorResult) {
          return;
        }

        shouldOpenCallbackSectionAfterCalculatorResult = false;
        openHomepageCallbackSection();
      });
    }

    if (calculatorDownloadPdfButton) {
      calculatorDownloadPdfButton.addEventListener("click", downloadCalculatorResultPdf);
    }

    if (calculatorRequestCallbackButton) {
      calculatorRequestCallbackButton.addEventListener("click", (event) => {
        event.preventDefault();
        shouldOpenCallbackSectionAfterCalculatorResult = true;

        if (window.jQuery && calculatorResultModal) {
          window.jQuery(calculatorResultModal).modal("hide");
          return;
        }

        shouldOpenCallbackSectionAfterCalculatorResult = false;
        openHomepageCallbackSection();
      });
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
  const turnstileApiSrc = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  let turnstileApiPromise = null;
  let callbackTurnstileRenderPromise = null;

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
    if (window.turnstile && typeof window.turnstile.render === "function") {
      return Promise.resolve(window.turnstile);
    }

    if (turnstileApiPromise) {
      return turnstileApiPromise;
    }

    turnstileApiPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${turnstileApiSrc}"]`);
      const script = existingScript || document.createElement("script");
      const startedAt = Date.now();

      const cleanup = () => {
        window.clearInterval(intervalId);
        script.removeEventListener("error", handleScriptError);
      };

      const rejectWithError = (error) => {
        cleanup();
        turnstileApiPromise = null;
        reject(error);
      };

      const handleScriptError = () => {
        rejectWithError(new Error("Turnstile failed to load."));
      };

      const intervalId = window.setInterval(() => {
        if (window.turnstile && typeof window.turnstile.render === "function") {
          cleanup();
          resolve(window.turnstile);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          rejectWithError(new Error("Turnstile failed to load."));
        }
      }, 100);

      script.addEventListener("error", handleScriptError);

      if (!existingScript) {
        script.src = turnstileApiSrc;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });

    return turnstileApiPromise;
  };

  const resetCallbackTurnstile = () => {
    callbackTurnstileToken = "";

    if (window.turnstile && callbackTurnstileWidgetId !== null) {
      window.turnstile.reset(callbackTurnstileWidgetId);
    }
  };

  const warmCallbackTurnstile = () => {
    if (!callbackForm || !callbackTurnstileContainer || callbackTurnstileWidgetId !== null || callbackTurnstileRenderPromise) {
      return;
    }

    renderCallbackTurnstile();
  };

  const waitForCallbackTurnstile = async () => {
    if (callbackTurnstileWidgetId !== null) {
      return;
    }

    await renderCallbackTurnstile();
  };

  const renderCallbackTurnstile = async () => {
    if (!callbackForm || !callbackTurnstileContainer) {
      return;
    }

    const callbackConfig = getCallbackFormConfig();

    if (!callbackConfig || callbackTurnstileWidgetId !== null) {
      return;
    }

    if (callbackTurnstileRenderPromise) {
      await callbackTurnstileRenderPromise;
      return;
    }

    callbackTurnstileReady = false;

    callbackTurnstileRenderPromise = (async () => {
      try {
        const turnstile = await waitForTurnstileApi();

        if (callbackTurnstileWidgetId !== null) {
          return;
        }

        callbackTurnstileWidgetId = turnstile.render(callbackTurnstileContainer, {
          sitekey: callbackConfig.turnstileSiteKey,
          theme: "light",
          appearance: "always",
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
      } finally {
        callbackTurnstileRenderPromise = null;
      }
    })();

    await callbackTurnstileRenderPromise;
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
    const callbackInteractionFields = callbackForm.querySelectorAll("input:not([type=\"hidden\"]), textarea, select");

    callbackInteractionFields.forEach((field) => {
      field.addEventListener("focus", warmCallbackTurnstile, { once: true });
      field.addEventListener("input", warmCallbackTurnstile, { once: true });
    });

    callbackSubmitButton.addEventListener("click", warmCallbackTurnstile, { passive: true });

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

      if (callbackTurnstileWidgetId === null) {
        await waitForCallbackTurnstile();
      }

      payload.turnstile_token = callbackTurnstileToken;

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
          "Thanks for reaching out to us. One of our agents will get back to you very soon."
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

  const leadChatWidget = document.getElementById("leadChatWidget");
  const leadChatLauncher = document.getElementById("leadChatLauncher");
  const leadChatPanel = document.getElementById("leadChatPanel");
  const leadChatClose = document.getElementById("leadChatClose");
  const leadChatMessages = document.getElementById("leadChatMessages");
  const leadChatHandoff = document.getElementById("leadChatHandoff");
  const leadChatHandoffCopy = document.getElementById("leadChatHandoffCopy");
  const leadChatTurnstileContainer = document.getElementById("leadChatTurnstile");
  const leadChatForm = document.getElementById("leadChatForm");
  const leadChatInput = document.getElementById("leadChatInput");
  let leadChatInitialized = false;
  let leadChatMode = "idle";
  let leadChatTurnstileWidgetId = null;
  let leadChatTurnstileToken = "";
  let leadChatTurnstileReady = false;
  let leadChatTurnstileRenderPromise = null;
  let leadChatSubmitting = false;
  let leadChatCloseTimerId = 0;
  const leadChatBookingUrl = "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2PwLnMIboXJYLmTsCPplmIsfxdOpZLqBosbVhaP4f5xH1Wp7McyVyYGjV9aMC20yGazrkx0koT";
  const leadChatLead = {
    helpRequest: "",
    creditScore: "",
    amountNeeded: "",
    creditAndAmount: "",
    productType: "",
    propertyLocation: "",
    propertyLocationConfirmed: false,
    postalCode: "",
    timeline: "",
    rawName: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: ""
  };

  if (
    leadChatWidget &&
    leadChatLauncher &&
    leadChatPanel &&
    leadChatClose &&
    leadChatMessages &&
    leadChatHandoff &&
    leadChatHandoffCopy &&
    leadChatTurnstileContainer &&
    leadChatForm &&
    leadChatInput
  ) {
    const scrollLeadChatToBottom = () => {
      window.requestAnimationFrame(() => {
        leadChatMessages.scrollTop = leadChatMessages.scrollHeight;
      });
    };

    const setLeadChatPlaceholder = (value) => {
      leadChatInput.placeholder = value;
    };

    const setLeadChatHandoffCopy = (text) => {
      if (!leadChatHandoffCopy) {
        return;
      }

      leadChatHandoffCopy.textContent = text;
    };

    const hideLeadChatHandoff = () => {
      leadChatHandoff.hidden = true;
      setLeadChatHandoffCopy("One quick security check and I will send this to Cashly.");
    };

    const showLeadChatHandoff = (text) => {
      if (text) {
        setLeadChatHandoffCopy(text);
      }

      leadChatHandoff.hidden = false;
      scrollLeadChatToBottom();
    };

    const resetLeadChatTurnstile = () => {
      leadChatTurnstileToken = "";

      if (window.turnstile && leadChatTurnstileWidgetId !== null) {
        window.turnstile.reset(leadChatTurnstileWidgetId);
      }
    };

    const splitLeadChatName = (value) => {
      const trimmedValue = value.trim().replace(/\s+/g, " ");
      const nameParts = trimmedValue.split(" ").filter(Boolean);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "Lead";

      return {
        rawName: trimmedValue,
        firstName,
        lastName
      };
    };

    const getLeadChatFirstName = () => {
      return leadChatLead.firstName || "there";
    };

    const extractLeadChatEmail = (value) => {
      const match = value.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
      return match ? match[0].toLowerCase() : "";
    };

    const normalizeLeadChatPhone = (value) => {
      const trimmedValue = value.trim();

      if (!trimmedValue) {
        return "";
      }

      const match = trimmedValue.match(/(\+?[\d\s().-]{7,})/);
      const candidate = match ? match[1].trim() : trimmedValue;
      const hasLeadingPlus = candidate.startsWith("+");
      const digitsOnly = candidate.replace(/\D/g, "");

      if (digitsOnly.length < 10) {
        return "";
      }

      return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
    };

    const extractLeadChatCreditScore = (value) => {
      const explicitMatch = value.match(
        /credit(?:\s+score)?(?:\s+is|\s*[:=-])?\s*(?:less than|under|below|around|about|approx(?:imately)?|near)?\s*(\d{3})/i
      );

      if (explicitMatch) {
        return explicitMatch[1];
      }

      const scoreMatch = value.match(/\bscore(?:\s+is|\s*[:=-])?\s*(\d{3})\b/i);
      return scoreMatch ? scoreMatch[1] : "";
    };

    const extractLeadChatAmountNeeded = (value) => {
      const amountContextMatch = value.match(
        /(?:need|borrow|looking for|amount|require|required)\s+(\$?\s?\d[\d,]*(?:\.\d+)?\s*(?:k|m)?)/i
      );

      if (amountContextMatch) {
        const contextualAmount = amountContextMatch[1].replace(/\s+/g, " ").trim();
        return /\d/.test(contextualAmount) ? contextualAmount : "";
      }

      const currencyMatch = value.match(/(\$\s?\d[\d,]*(?:\.\d+)?\s*(?:k|m)?)/i);

      if (currencyMatch) {
        const currencyAmount = currencyMatch[1].replace(/\s+/g, " ").trim();
        return /\d/.test(currencyAmount) ? currencyAmount : "";
      }

      if (!/[km]\b/i.test(value)) {
        return "";
      }

      const amountMatch = value.match(/(\d[\d,]*(?:\.\d+)?\s*(?:k|m))/i);

      if (!amountMatch) {
        return "";
      }

      const amount = amountMatch[1].replace(/\s+/g, " ").trim();
      return /\d/.test(amount) ? amount : "";
    };

    const extractStandaloneLeadChatScore = (value) => {
      const trimmedValue = value.trim();
      const scoreMatch = trimmedValue.match(/^(\d{3})$/);

      if (!scoreMatch) {
        return "";
      }

      const score = Number.parseInt(scoreMatch[1], 10);
      return score >= 300 && score <= 900 ? scoreMatch[1] : "";
    };

    const extractContextualLeadChatScore = (value) => {
      const contextualPatterns = [
        /\b(?:i have|i'm at|im at|mine is|it is|it's|its|around|about|roughly|approx(?:imately)?)\s+(\d{3})\b/i,
        /\b(\d{3})\b(?=.*\bcredit\b)/i
      ];

      for (const pattern of contextualPatterns) {
        const match = value.match(pattern);

        if (!match) {
          continue;
        }

        const score = Number.parseInt(match[1], 10);

        if (score >= 300 && score <= 900) {
          return match[1];
        }
      }

      return "";
    };

    const detectLeadChatProductType = (value) => {
      const normalizedValue = value.toLowerCase();

      if (normalizedValue.includes("line of credit") || normalizedValue.includes("heloc") || /\bloc\b/.test(normalizedValue)) {
        return "line of credit";
      }

      if (normalizedValue.includes("construction")) {
        return "construction";
      }

      if (normalizedValue.includes("refinance") || normalizedValue.includes("refinancing") || normalizedValue.includes("refi")) {
        return "refinance";
      }

      if (normalizedValue.includes("private mortgage") || normalizedValue.includes("mortgage")) {
        return "private mortgage";
      }

      return "";
    };

    const getLeadChatProductTypePrompt = () => {
      return "Are you looking for refinance, construction, line of credit, or private mortgage?";
    };

    const detectLeadChatTimeline = (value) => {
      const normalizedValue = value.toLowerCase();

      if (
        normalizedValue.includes("urgent") ||
        normalizedValue.includes("asap") ||
        normalizedValue.includes("immediately") ||
        normalizedValue.includes("right away") ||
        normalizedValue.includes("today") ||
        normalizedValue.includes("tomorrow")
      ) {
        return value.trim();
      }

      const timelineMatch = value.match(/\b(?:within\s+)?\d+\s*(?:day|days|week|weeks|month|months)\b/i);
      return timelineMatch ? timelineMatch[0].trim() : "";
    };

    const extractLeadChatPostalCode = (value) => {
      const postalMatch = value.match(/\b([A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d)\b/);

      if (!postalMatch) {
        return "";
      }

      return postalMatch[1].toUpperCase().replace(/\s+/g, "").replace(
        /^([A-Z]\d[A-Z])(\d[A-Z]\d)$/,
        "$1 $2"
      );
    };

    const isValidLeadChatPropertyLocation = (value) => {
      const trimmedValue = value.trim().replace(/\s+/g, " ");
      const letterCount = (trimmedValue.match(/[A-Za-z]/g) || []).length;

      if (trimmedValue.length < 3 || letterCount < 3) {
        return false;
      }

      return /[A-Za-z]/.test(trimmedValue);
    };

    const requiresLeadChatPropertyDetails = () => {
      return leadChatLead.productType === "construction" || leadChatLead.productType === "refinance";
    };

    const syncLeadChatCreditAndAmount = () => {
      const parts = [];

      if (leadChatLead.creditScore) {
        parts.push(`credit score: ${leadChatLead.creditScore}`);
      }

      if (leadChatLead.amountNeeded) {
        parts.push(`amount needed: ${leadChatLead.amountNeeded}`);
      }

      leadChatLead.creditAndAmount = parts.join(", ");
    };

    const absorbLeadChatDetails = (value) => {
      if (!leadChatLead.creditScore) {
        leadChatLead.creditScore = extractLeadChatCreditScore(value);
      }

      if (!leadChatLead.amountNeeded) {
        leadChatLead.amountNeeded = extractLeadChatAmountNeeded(value);
      }

      if (!leadChatLead.productType) {
        leadChatLead.productType = detectLeadChatProductType(value);
      }

      if (!leadChatLead.timeline) {
        leadChatLead.timeline = detectLeadChatTimeline(value);
      }

      if (!leadChatLead.postalCode) {
        leadChatLead.postalCode = extractLeadChatPostalCode(value);
      }

      syncLeadChatCreditAndAmount();
    };

    const getNextLeadChatPrompt = () => {
      if (!leadChatLead.creditScore && !leadChatLead.amountNeeded) {
        return {
          mode: "awaiting-credit-amount",
          message: "Can I know your credit score?"
        };
      }

      if (!leadChatLead.creditScore) {
        return {
          mode: "awaiting-credit-amount",
          message: "Thanks. Can I know your credit score?"
        };
      }

      if (!leadChatLead.amountNeeded) {
        return {
          mode: "awaiting-credit-amount",
          message: "Thanks. How much money do you need?"
        };
      }

      if (!leadChatLead.productType) {
        return {
          mode: "awaiting-product-type",
          message: getLeadChatProductTypePrompt()
        };
      }

      if (requiresLeadChatPropertyDetails() && !leadChatLead.propertyLocation) {
        return {
          mode: "awaiting-property-location",
          message: "Where is your property located?"
        };
      }

      if (requiresLeadChatPropertyDetails() && leadChatLead.propertyLocation && !leadChatLead.propertyLocationConfirmed) {
        return {
          mode: "awaiting-property-confirmation",
          message: "Is this the property?"
        };
      }

      if (requiresLeadChatPropertyDetails() && !leadChatLead.postalCode) {
        return {
          mode: "awaiting-postal-code",
          message: "What is the postal code for the property?"
        };
      }

      if (!leadChatLead.timeline) {
        return {
          mode: "awaiting-timeline",
          message: "How soon do you need the money?"
        };
      }

      return {
        mode: "awaiting-name",
        message: "Please enter your full name."
      };
    };

    const resetLeadChatLead = () => {
      leadChatMode = "idle";
      leadChatLead.helpRequest = "";
      leadChatLead.creditScore = "";
      leadChatLead.amountNeeded = "";
      leadChatLead.creditAndAmount = "";
      leadChatLead.productType = "";
      leadChatLead.propertyLocation = "";
      leadChatLead.propertyLocationConfirmed = false;
      leadChatLead.postalCode = "";
      leadChatLead.timeline = "";
      leadChatLead.rawName = "";
      leadChatLead.firstName = "";
      leadChatLead.lastName = "";
      leadChatLead.email = "";
      leadChatLead.phone = "";
      leadChatSubmitting = false;
      resetLeadChatTurnstile();
      hideLeadChatHandoff();
      setLeadChatPlaceholder("Message Cashly");
    };

    const appendLeadChatMessage = (role, text, actions = []) => {
      const message = document.createElement("div");
      message.className = `lead-chat__message lead-chat__message--${role}`;

      const bubble = document.createElement("div");
      bubble.className = "lead-chat__bubble";
      bubble.textContent = text;
      message.appendChild(bubble);

      if (actions.length > 0) {
        const actionsRow = document.createElement("div");
        actionsRow.className = "lead-chat__actions";

        actions.forEach((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "lead-chat__action";
          button.dataset.chatAction = item.action;
          button.dataset.chatLabel = item.label;
          button.textContent = item.label;
          actionsRow.appendChild(button);
        });

        bubble.appendChild(actionsRow);
      }

      leadChatMessages.appendChild(message);
      scrollLeadChatToBottom();
    };

    const getLeadChatMapEmbedUrl = (location) => {
      const query = encodeURIComponent(location.trim());
      return `https://maps.google.com/maps?q=${query}&z=15&output=embed`;
    };

    const getLeadChatMapLinkUrl = (location) => {
      const query = encodeURIComponent(location.trim());
      return `https://www.google.com/maps/search/?api=1&query=${query}`;
    };

    const appendLeadChatPropertyConfirmation = (location) => {
      const message = document.createElement("div");
      message.className = "lead-chat__message lead-chat__message--bot";

      const bubble = document.createElement("div");
      bubble.className = "lead-chat__bubble";

      const intro = document.createElement("p");
      intro.className = "lead-chat__map-intro";
      intro.textContent = "I found this property. Is this the right one?";
      bubble.appendChild(intro);

      const mapCard = document.createElement("div");
      mapCard.className = "lead-chat__map-card";

      const mapFrame = document.createElement("iframe");
      mapFrame.className = "lead-chat__map-frame";
      mapFrame.src = getLeadChatMapEmbedUrl(location);
      mapFrame.title = `Property map preview for ${location}`;
      mapFrame.loading = "lazy";
      mapFrame.referrerPolicy = "no-referrer-when-downgrade";
      mapCard.appendChild(mapFrame);

      const mapMeta = document.createElement("div");
      mapMeta.className = "lead-chat__map-meta";

      const mapAddress = document.createElement("strong");
      mapAddress.textContent = location;
      mapMeta.appendChild(mapAddress);

      const mapLink = document.createElement("a");
      mapLink.className = "lead-chat__map-link";
      mapLink.href = getLeadChatMapLinkUrl(location);
      mapLink.target = "_blank";
      mapLink.rel = "noopener noreferrer";
      mapLink.textContent = "Open in Google Maps";
      mapMeta.appendChild(mapLink);

      mapCard.appendChild(mapMeta);
      bubble.appendChild(mapCard);

      const actionsRow = document.createElement("div");
      actionsRow.className = "lead-chat__actions";

      [
        { label: "Yes", action: "confirm-property-location" },
        { label: "No", action: "reject-property-location" }
      ].forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "lead-chat__action";
        button.dataset.chatAction = item.action;
        button.dataset.chatLabel = item.label;
        button.textContent = item.label;
        actionsRow.appendChild(button);
      });

      bubble.appendChild(actionsRow);
      message.appendChild(bubble);
      leadChatMessages.appendChild(message);
      scrollLeadChatToBottom();
    };

    const promptLeadChatPropertyConfirmation = () => {
      leadChatMode = "awaiting-property-confirmation";
      appendLeadChatPropertyConfirmation(leadChatLead.propertyLocation);
      setLeadChatPlaceholder("Type yes or no");
    };

    const handleLeadChatPropertyConfirmation = () => {
      leadChatLead.propertyLocationConfirmed = true;
      const nextStep = getNextLeadChatPrompt();
      leadChatMode = nextStep.mode;
      appendLeadChatMessage("bot", nextStep.message);
      setLeadChatPlaceholder("");
    };

    const handleLeadChatPropertyRejection = () => {
      leadChatLead.propertyLocation = "";
      leadChatLead.propertyLocationConfirmed = false;
      leadChatMode = "awaiting-property-location";
      appendLeadChatMessage("bot", "Please enter the full property address so I can check it again.");
      setLeadChatPlaceholder("Enter the property address");
    };

    const isAffirmativeLeadChatAnswer = (value) => /^(yes|yep|yeah|correct|right|that'?s right|this one)$/i.test(value.trim());
    const isNegativeLeadChatAnswer = (value) => /^(no|nope|wrong|not this|not correct|different)$/i.test(value.trim());
    const normalizeLeadChatAmountNeeded = (value) => {
      const trimmedValue = value.trim();

      if (!trimmedValue) {
        return "";
      }

      const match = trimmedValue.match(/\$?\s*(\d[\d,]*(?:\.\d+)?)\s*([km])?/i);

      if (!match) {
        return trimmedValue;
      }

      const numericValue = Number.parseFloat(match[1].replace(/,/g, ""));

      if (!Number.isFinite(numericValue)) {
        return trimmedValue;
      }

      const suffix = (match[2] || "").toLowerCase();
      let expandedValue = numericValue;

      if (suffix === "k") {
        expandedValue *= 1000;
      } else if (suffix === "m") {
        expandedValue *= 1000000;
      }

      return expandedValue.toLocaleString("en-CA", {
        maximumFractionDigits: 0
      });
    };

    const normalizeLeadChatTimeline = (value) => {
      const trimmedValue = value.trim().replace(/\s+/g, " ");

      if (!trimmedValue) {
        return "";
      }

      if (/(urgent|asap|immediately|right away|today|tomorrow)/i.test(trimmedValue)) {
        return "ASAP";
      }

      const match = trimmedValue.match(/(?:within\s+)?(\d+)\s*(day|days|week|weeks|month|months)\b/i);

      if (!match) {
        return trimmedValue;
      }

      const quantity = match[1];
      const normalizedUnit = match[2].toLowerCase().replace(/s$/, "");
      const pluralizedUnit = quantity === "1" ? normalizedUnit : `${normalizedUnit}s`;

      return `${quantity} ${pluralizedUnit}`;
    };

    const getLeadChatPropertyAddress = () => {
      return [leadChatLead.propertyLocation, leadChatLead.postalCode].filter(Boolean).join(", ");
    };

    const cleanLeadChatPayload = (payload) => {
      return Object.fromEntries(
        Object.entries(payload).filter(([, value]) => {
          if (typeof value === "string") {
            return value.trim() !== "";
          }

          return value !== null && value !== undefined;
        })
      );
    };

    const renderLeadChatTurnstile = async () => {
      const callbackConfig = getCallbackFormConfig();

      if (!callbackConfig || leadChatTurnstileWidgetId !== null) {
        return;
      }

      if (leadChatTurnstileRenderPromise) {
        await leadChatTurnstileRenderPromise;
        return;
      }

      leadChatTurnstileReady = false;
      leadChatTurnstileRenderPromise = (async () => {
        try {
          const turnstile = await waitForTurnstileApi();

          if (leadChatTurnstileWidgetId !== null) {
            return;
          }

          leadChatTurnstileWidgetId = turnstile.render(leadChatTurnstileContainer, {
            sitekey: callbackConfig.turnstileSiteKey,
            theme: "light",
            appearance: "always",
            callback(token) {
              leadChatTurnstileToken = token;
              leadChatTurnstileReady = true;

              if (leadChatMode === "awaiting-security" && !leadChatSubmitting) {
                submitLeadChatLead();
              }
            },
            "expired-callback"() {
              leadChatTurnstileToken = "";
            },
            "timeout-callback"() {
              leadChatTurnstileToken = "";
            },
            "error-callback"(errorCode) {
              leadChatTurnstileToken = "";
              leadChatTurnstileReady = false;
              console.error("Lead chat Turnstile error:", errorCode);
              setLeadChatHandoffCopy("The security check could not load. Refresh the page and try again.");
              return true;
            }
          });

          leadChatTurnstileReady = true;
        } catch (error) {
          leadChatTurnstileReady = false;
          setLeadChatHandoffCopy("The security check could not load. Refresh the page and try again.");
        } finally {
          leadChatTurnstileRenderPromise = null;
        }
      })();

      await leadChatTurnstileRenderPromise;
    };

    const submitLeadChatLead = async () => {
      if (leadChatSubmitting || leadChatMode !== "awaiting-security") {
        return;
      }

      if (
        !leadChatLead.helpRequest ||
        !leadChatLead.creditAndAmount ||
        !leadChatLead.productType ||
        !leadChatLead.timeline ||
        !leadChatLead.firstName ||
        !leadChatLead.lastName ||
        !leadChatLead.email ||
        !leadChatLead.phone
      ) {
        return;
      }

      if (!leadChatTurnstileReady) {
        setLeadChatHandoffCopy("The security check is still loading. Please wait a moment.");
        return;
      }

      if (!leadChatTurnstileToken) {
        setLeadChatHandoffCopy("Please complete the security check and I will send this to Cashly.");
        return;
      }

      leadChatSubmitting = true;
      setLeadChatHandoffCopy("Sending your message to Cashly now.");

      try {
        const leadChatPayload = cleanLeadChatPayload({
          fullname: leadChatLead.rawName || `${leadChatLead.firstName} ${leadChatLead.lastName}`.trim(),
          address: "",
          phone: leadChatLead.phone,
          email: leadChatLead.email,
          credit_score: leadChatLead.creditScore,
          amount_needed: normalizeLeadChatAmountNeeded(leadChatLead.amountNeeded),
          purchase_type: leadChatLead.productType,
          property_address: getLeadChatPropertyAddress(),
          timeline: normalizeLeadChatTimeline(leadChatLead.timeline),
          message: leadChatLead.helpRequest
        });

        await submitCallbackToEdgeFunction({
          first_name: leadChatLead.firstName,
          last_name: leadChatLead.lastName,
          email: leadChatLead.email,
          phone: leadChatLead.phone,
          message: JSON.stringify(leadChatPayload, null, 2),
          company_name: "",
          source_page: `${window.location.pathname}#lead-chat`,
          turnstile_token: leadChatTurnstileToken
        });

        appendLeadChatMessage(
          "bot",
          `Thanks ${getLeadChatFirstName()}. One of our agents will get back to you very soon.`
        );
        resetLeadChatLead();
        leadChatMode = "submitted";
        appendLeadChatMessage(
          "bot",
          "Do you want to book appointment now? I think you are in urgent.",
          [
            { label: "Book Appointment", action: "book-appointment" }
          ]
        );
      } catch (error) {
        resetLeadChatTurnstile();
        leadChatSubmitting = false;
        setLeadChatHandoffCopy("Please complete the security check again so I can resend this.");
        appendLeadChatMessage(
          "bot",
          error.message || "Something went wrong while sending your message. Please try again."
        );
      }
    };

    const seedLeadChat = () => {
      if (leadChatInitialized) {
        return;
      }

      appendLeadChatMessage("bot", "Hi, tell me how I can help you today.");
      leadChatInitialized = true;
      setLeadChatPlaceholder("Message Cashly");
    };

    const openLeadChat = () => {
      seedLeadChat();
      window.clearTimeout(leadChatCloseTimerId);
      leadChatPanel.hidden = false;
      leadChatPanel.setAttribute("aria-hidden", "false");
      leadChatPanel.classList.remove("is-closing");
      leadChatLauncher.setAttribute("aria-expanded", "true");
      document.body.classList.add("chat-open");

      window.requestAnimationFrame(() => {
        leadChatPanel.classList.add("is-open");
      });

      window.setTimeout(() => {
        leadChatInput.focus();
      }, 80);
    };

    const closeLeadChat = () => {
      leadChatPanel.classList.remove("is-open");
      leadChatPanel.classList.add("is-closing");
      leadChatLauncher.setAttribute("aria-expanded", "false");
      leadChatPanel.setAttribute("aria-hidden", "true");
      document.body.classList.remove("chat-open");
      leadChatCloseTimerId = window.setTimeout(() => {
        leadChatPanel.hidden = true;
        leadChatPanel.classList.remove("is-closing");
      }, 280);
    };

    const finishLeadChatContactCapture = async () => {
      leadChatMode = "awaiting-security";
      showLeadChatHandoff("One quick security check and I will send this to Cashly.");
      appendLeadChatMessage(
        "bot",
        `Perfect ${getLeadChatFirstName()}. Complete the security check below and I will send this through.`
      );
      setLeadChatPlaceholder("Security check required");
      await renderLeadChatTurnstile();

      if (leadChatTurnstileToken) {
        submitLeadChatLead();
      }
    };

    leadChatLauncher.addEventListener("click", () => {
      if (leadChatPanel.hidden) {
        openLeadChat();
      } else {
        closeLeadChat();
      }
    });

    leadChatClose.addEventListener("click", closeLeadChat);

    leadChatMessages.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-chat-action]");

      if (!actionButton) {
        return;
      }

      const action = actionButton.dataset.chatAction || "";

      if (action === "book-appointment") {
        window.open(leadChatBookingUrl, "_blank", "noopener,noreferrer");
        return;
      }

      if (action === "confirm-property-location") {
        handleLeadChatPropertyConfirmation();
        return;
      }

      if (action === "reject-property-location") {
        handleLeadChatPropertyRejection();
      }
    });

    leadChatForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const answer = leadChatInput.value.trim();

      if (!answer) {
        leadChatInput.focus();
        return;
      }

      appendLeadChatMessage("user", answer);
      leadChatInput.value = "";

      if (leadChatMode === "submitted") {
        appendLeadChatMessage(
          "bot",
          "Do you want to book appointment now? I think you are in urgent.",
          [
            { label: "Book Appointment", action: "book-appointment" }
          ]
        );
        setLeadChatPlaceholder("Message Cashly");
        return;
      }

      if (leadChatMode === "idle") {
        leadChatLead.helpRequest = answer;
        absorbLeadChatDetails(answer);
        const nextStep = getNextLeadChatPrompt();
        leadChatMode = nextStep.mode;
        appendLeadChatMessage("bot", nextStep.message);
        setLeadChatPlaceholder("");
        return;
      }

      if (leadChatMode === "awaiting-credit-amount") {
        if (!leadChatLead.creditScore) {
          const standaloneScore = extractStandaloneLeadChatScore(answer) || extractContextualLeadChatScore(answer);

          if (standaloneScore) {
            leadChatLead.creditScore = standaloneScore;
            syncLeadChatCreditAndAmount();
          }
        }

        absorbLeadChatDetails(answer);

        if (!leadChatLead.creditScore && !leadChatLead.amountNeeded) {
          appendLeadChatMessage("bot", "Please share your credit score.");
          return;
        }

        if (!leadChatLead.creditScore) {
          appendLeadChatMessage("bot", "Thanks. I still need your credit score.");
          return;
        }

        if (!leadChatLead.amountNeeded) {
          appendLeadChatMessage("bot", "Thanks. I still need to know how much money you need.");
          return;
        }

        const nextStep = getNextLeadChatPrompt();
        leadChatMode = nextStep.mode;
        appendLeadChatMessage("bot", nextStep.message);
        setLeadChatPlaceholder("");
        return;
      }

      if (leadChatMode === "awaiting-product-type") {
        const detectedProductType = detectLeadChatProductType(answer);

        if (!detectedProductType) {
          appendLeadChatMessage(
            "bot",
            `${getLeadChatProductTypePrompt()} Please choose one of those options.`
          );
          return;
        }

        leadChatLead.productType = detectedProductType;
        absorbLeadChatDetails(answer);
        const nextStep = getNextLeadChatPrompt();
        leadChatMode = nextStep.mode;
        appendLeadChatMessage("bot", nextStep.message);
        setLeadChatPlaceholder("");
        return;
      }

      if (leadChatMode === "awaiting-property-location") {
        if (!isValidLeadChatPropertyLocation(answer)) {
          appendLeadChatMessage("bot", "Please enter a valid property location, like a city or full address.");
          return;
        }

        leadChatLead.propertyLocation = answer.trim().replace(/\s+/g, " ");
        leadChatLead.propertyLocationConfirmed = false;
        absorbLeadChatDetails(answer);
        promptLeadChatPropertyConfirmation();
        return;
      }

      if (leadChatMode === "awaiting-property-confirmation") {
        if (isAffirmativeLeadChatAnswer(answer)) {
          handleLeadChatPropertyConfirmation();
          return;
        }

        if (isNegativeLeadChatAnswer(answer)) {
          handleLeadChatPropertyRejection();
          return;
        }

        appendLeadChatMessage("bot", "Please answer yes or no so I can confirm the property.");
        return;
      }

      if (leadChatMode === "awaiting-postal-code") {
        const extractedPostalCode = extractLeadChatPostalCode(answer);

        if (!extractedPostalCode) {
          appendLeadChatMessage("bot", "Please enter a valid postal code for the property.");
          return;
        }

        leadChatLead.postalCode = extractedPostalCode;
        const nextStep = getNextLeadChatPrompt();
        leadChatMode = nextStep.mode;
        appendLeadChatMessage("bot", nextStep.message);
        setLeadChatPlaceholder("");
        return;
      }

      if (leadChatMode === "awaiting-timeline") {
        leadChatLead.timeline = detectLeadChatTimeline(answer) || answer.trim();
        const nextStep = getNextLeadChatPrompt();
        leadChatMode = nextStep.mode;
        appendLeadChatMessage("bot", nextStep.message);
        setLeadChatPlaceholder("");
        return;
      }

      if (leadChatMode === "awaiting-name") {
        const parsedName = splitLeadChatName(answer);

        if (!parsedName.firstName) {
          appendLeadChatMessage("bot", "Please enter your name so I can pass this to Cashly.");
          return;
        }

        leadChatLead.rawName = parsedName.rawName;
        leadChatLead.firstName = parsedName.firstName;
        leadChatLead.lastName = parsedName.lastName;
        leadChatMode = "awaiting-email";
        appendLeadChatMessage("bot", `Alright ${parsedName.firstName}, please enter your email address.`);
        setLeadChatPlaceholder("");
        return;
      }

      if (leadChatMode === "awaiting-email") {
        const extractedEmail = extractLeadChatEmail(answer);

        if (!extractedEmail) {
          appendLeadChatMessage("bot", "Please enter a valid email address.");
          return;
        }

        leadChatLead.email = extractedEmail;
        leadChatMode = "awaiting-phone";
        appendLeadChatMessage("bot", "Great, now please enter your phone number.");
        setLeadChatPlaceholder("");
        return;
      }

      if (leadChatMode === "awaiting-phone") {
        const extractedPhone = normalizeLeadChatPhone(answer);

        if (!extractedPhone) {
          appendLeadChatMessage("bot", "Please enter a valid phone number.");
          return;
        }

        leadChatLead.phone = extractedPhone;
        await finishLeadChatContactCapture();
        return;
      }

      if (leadChatMode === "awaiting-security") {
        appendLeadChatMessage("bot", "Complete the security check below and I will send this to Cashly.");
        return;
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !leadChatPanel.hidden) {
        closeLeadChat();
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
