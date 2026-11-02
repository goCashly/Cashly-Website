/**
 * Cashly analytics + conversion tracking.
 * Pushes events into the GTM dataLayer (see the GTM container snippet in <head>/<body>).
 * No PII (name, email, phone) is ever pushed — only event names, step labels, and UTM/attribution data.
 */
(function () {
  "use strict";

  window.dataLayer = window.dataLayer || [];

  function pushEvent(name, params) {
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
  }

  // ---------------------------------------------------------------------
  // UTM capture + attribution pass-through
  // Captures utm_source/utm_medium/utm_campaign/utm_term/utm_content and the
  // landing page on first visit, persists them for the session, and quietly
  // stamps hidden fields on lead forms so attribution travels with the lead
  // (never sent to GA4 itself — only into the form payload / CRM).
  // ---------------------------------------------------------------------
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  var STORAGE_KEY = "cashly_attribution";

  function captureAttribution() {
    try {
      var params = new URLSearchParams(window.location.search);
      var hasUtm = UTM_KEYS.some(function (k) { return params.has(k); });
      var existing = null;
      try {
        existing = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      } catch (e) {
        existing = null;
      }

      if (hasUtm || !existing) {
        var attribution = existing || {};
        if (hasUtm) {
          UTM_KEYS.forEach(function (k) {
            if (params.has(k)) attribution[k] = params.get(k);
          });
          attribution.landing_page = window.location.pathname + window.location.search;
          attribution.referrer = document.referrer || "direct";
        }
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
        } catch (e) {
          /* storage unavailable (private mode, blocked) — attribution just won't persist */
        }
        return attribution;
      }
      return existing;
    } catch (e) {
      return null;
    }
  }

  function getAttribution() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function stampAttributionOnForm(form, attribution) {
    if (!form || !attribution) return;
    Object.keys(attribution).forEach(function (key) {
      var fieldName = "attribution_" + key;
      var field = form.querySelector('[name="' + fieldName + '"]');
      if (!field) {
        field = document.createElement("input");
        field.type = "hidden";
        field.name = fieldName;
        form.appendChild(field);
      }
      field.value = attribution[key] || "";
    });
  }

  var attribution = captureAttribution();

  document.addEventListener("DOMContentLoaded", function () {
    var leadForms = document.querySelectorAll(
      "#contactForm, #homeCallbackForm, #calculatorLeadForm, #eventLeadForm"
    );
    leadForms.forEach(function (form) {
      stampAttributionOnForm(form, attribution || getAttribution());
    });
  });

  // ---------------------------------------------------------------------
  // Conversion + engagement events
  // ---------------------------------------------------------------------
  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    // quote_start — rate-quote modal opened
    if (typeof window.jQuery !== "undefined") {
      window.jQuery(document).on("shown.bs.modal", "#borrowerCalculatorModal", function () {
        pushEvent("quote_start");
      });
    }

    // quote_step — borrower moves between steps of the rate-quote quiz
    var calculatorForm = document.getElementById("mortgageCalculatorForm");
    if (calculatorForm && window.MutationObserver) {
      var lastStep = null;
      var observer = new MutationObserver(function () {
        var activeStep = calculatorForm.querySelector(".calculator-quiz-step.is-active");
        var stepId = activeStep ? activeStep.getAttribute("data-step") : null;
        if (stepId && stepId !== lastStep) {
          lastStep = stepId;
          pushEvent("quote_step", { step: stepId });
        }
      });
      calculatorForm.querySelectorAll(".calculator-quiz-step").forEach(function (panel) {
        observer.observe(panel, { attributes: true, attributeFilter: ["class"] });
      });
    }

    // quote_submit — rate-quote lead form submitted
    var calculatorLeadForm = document.getElementById("calculatorLeadForm");
    if (calculatorLeadForm) {
      calculatorLeadForm.addEventListener("submit", function () {
        pushEvent("quote_submit");
      });
    }

    // generate_lead — other lead-capture forms (GA4 recommended event name)
    ["contactForm", "homeCallbackForm", "eventLeadForm"].forEach(function (id) {
      var form = document.getElementById(id);
      if (!form) return;
      form.addEventListener("submit", function () {
        pushEvent("generate_lead", { form_id: id });
      });
    });

    // form_error — native HTML5 validation failures (capture phase: "invalid" doesn't bubble)
    var erroredForms = new WeakSet();
    document.addEventListener(
      "invalid",
      function (event) {
        var form = event.target && event.target.form;
        if (!form || erroredForms.has(form)) return;
        erroredForms.add(form);
        pushEvent("form_error", { form_id: form.id || "unknown" });
        setTimeout(function () {
          erroredForms.delete(form);
        }, 1000);
      },
      true
    );

    // call_click — any tel: link
    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest('a[href^="tel:"]');
      if (link) {
        pushEvent("call_click", { phone_number: link.getAttribute("href").replace("tel:", "") });
      }
    });

    // consultation_booked — click-through to the booking calendar
    // (fires on click-through, not confirmed booking completion, since the
    // calendar itself is hosted off-site and can't report back to this page)
    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest('a[href*="calendar.google.com"]');
      if (link) {
        pushEvent("consultation_booked", { link_text: (link.textContent || "").trim() });
      }
    });
  });
})();
