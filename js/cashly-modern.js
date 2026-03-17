document.addEventListener("DOMContentLoaded", () => {
  if (window.AOS) {
    window.AOS.init({
      duration: 900,
      once: true
    });
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
    years: document.getElementById("calculator-summary-years")
  };

  if (
    calculatorInputs.property &&
    calculatorInputs.downPayment &&
    calculatorInputs.rate &&
    calculatorInputs.years &&
    calculatorOutputs.monthly &&
    calculatorOutputs.loan &&
    calculatorOutputs.interest &&
    calculatorOutputs.years
  ) {
    const currencyFormatter = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0
    });

    const getInputValue = (input) => {
      const parsed = Number.parseFloat(input.value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const updateCalculator = () => {
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

      calculatorOutputs.monthly.textContent = currencyFormatter.format(monthlyPayment);
      calculatorOutputs.loan.textContent = currencyFormatter.format(loanAmount);
      calculatorOutputs.interest.textContent = currencyFormatter.format(totalInterest);
      calculatorOutputs.years.textContent = `${Math.round(years)} years`;
    };

    Object.values(calculatorInputs).forEach((input) => {
      input.addEventListener("input", updateCalculator);
      input.addEventListener("change", updateCalculator);
    });

    updateCalculator();
  }

  const calculatorModal = document.getElementById("borrowerCalculatorModal");

  if (window.jQuery && calculatorModal && calculatorInputs.property) {
    window.jQuery(calculatorModal).on("shown.bs.modal", () => {
      calculatorInputs.property.focus();
      calculatorInputs.property.select();
    });
  }

  const callbackForm = document.getElementById("homeCallbackForm");
  const callbackMessage = document.getElementById("homeCallbackMessage");
  const callbackSubmitButton = document.getElementById("homeCallbackSubmitButton");

  if (callbackForm && callbackMessage && callbackSubmitButton) {
    callbackForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      callbackSubmitButton.disabled = true;
      callbackSubmitButton.textContent = "Sending";
      callbackMessage.className = "callback-message";
      callbackMessage.textContent = "";

      try {
        const response = await fetch(callbackForm.action, {
          method: "POST",
          body: new FormData(callbackForm),
          headers: {
            Accept: "application/json"
          }
        });

        if (response.ok) {
          callbackForm.reset();
          callbackMessage.className = "callback-message is-success";
          callbackMessage.textContent = "Message sent successfully. We’ll be in touch soon.";
        } else {
          callbackMessage.className = "callback-message is-error";
          callbackMessage.textContent = "Something went wrong. Please try again or email us directly.";
        }
      } catch (error) {
        callbackMessage.className = "callback-message is-error";
        callbackMessage.textContent = "Network error. Please try again in a moment.";
      } finally {
        callbackSubmitButton.disabled = false;
        callbackSubmitButton.textContent = "Submit";
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
