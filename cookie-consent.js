(() => {
  const STORAGE_KEY = "rumble_cookie_consent_v2";
  const CONSENT_ACCEPTED = "accepted";
  const CONSENT_DISMISSED = "dismissed";

  function getConsentValue() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function setConsentValue(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      return;
    }
  }

  function dispatchConsentEvent(value) {
    window.dataLayer = window.dataLayer || [];
    function gtag(){
      window.dataLayer.push(arguments);
    }
    gtag("consent", "update", {
      analytics_storage: value === CONSENT_ACCEPTED ? "granted" : "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });

    window.dispatchEvent(
      new CustomEvent("rumble-cookie-consent", {
        detail: { value },
      })
    );
  }

  function closeBanner() {
    const banner = document.getElementById("cookieConsentBanner");
    if (banner) banner.remove();
  }

  function injectStyles() {
    if (document.getElementById("cookieConsentStyles")) return;

    const style = document.createElement("style");
    style.id = "cookieConsentStyles";
    style.textContent = `
      .cookie-consent{
        position:fixed;
        right:20px;
        bottom:20px;
        z-index:100000;
        width:min(420px, calc(100vw - 24px));
        background:#FFFFFF;
        border:1px solid #D6DEE8;
        box-shadow:0 18px 44px rgba(15,23,42,.18);
        color:#0F172A;
        border-radius:6px;
      }
      .cookie-consent__inner{
        padding:18px 18px 16px;
      }
      .cookie-consent__top{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
      }
      .cookie-consent__copy{
        font:400 15px/1.6 Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
        color:#334155;
      }
      .cookie-consent__copy strong{
        color:#0F172A;
      }
      .cookie-consent__actions{
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:10px;
        margin-top:16px;
        flex-wrap:wrap;
      }
      .cookie-consent__link{
        margin-right:auto;
        color:#1F4FD8;
        text-decoration:underline;
        font:600 14px/1 Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
      }
      .cookie-consent__btn{
        min-height:42px;
        padding:10px 16px;
        border-radius:6px;
        border:1px solid #D6DEE8;
        background:#FFFFFF;
        color:#0F172A;
        font:600 14px/1 Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
        cursor:pointer;
      }
      .cookie-consent__btn--primary{
        background:#1F4FD8;
        border-color:#1F4FD8;
        color:#FFFFFF;
      }
      .cookie-consent__close{
        width:36px;
        height:36px;
        border:0;
        background:transparent;
        color:#475569;
        font-size:24px;
        line-height:1;
        cursor:pointer;
        padding:0;
        flex:0 0 auto;
      }
      @media (max-width: 768px){
        .cookie-consent{
          left:12px;
          right:12px;
          bottom:12px;
          width:auto;
        }
        .cookie-consent__inner{
          padding:16px;
        }
        .cookie-consent__actions{
          justify-content:stretch;
        }
        .cookie-consent__link{
          width:100%;
          margin-right:0;
        }
        .cookie-consent__btn{
          flex:1 1 0;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function buildBanner() {
    closeBanner();
    const banner = document.createElement("div");
    banner.className = "cookie-consent";
    banner.id = "cookieConsentBanner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Cookie consent");
    banner.innerHTML = `
      <div class="cookie-consent__inner">
        <div class="cookie-consent__top">
          <div class="cookie-consent__copy">
            We use cookies and analytics to understand website traffic and improve your experience.
            See our <strong>Privacy Policy</strong> and Cookie Policy for more details.
          </div>
          <button class="cookie-consent__close" type="button" aria-label="Close cookie notice">&times;</button>
        </div>
        <div class="cookie-consent__actions">
          <a class="cookie-consent__link" href="privacy-policy.html">Privacy Policy</a>
          <a class="cookie-consent__link" href="cookie-policy.html">Cookie Policy</a>
          <button class="cookie-consent__btn" type="button" data-consent="dismiss">Close</button>
          <button class="cookie-consent__btn cookie-consent__btn--primary" type="button" data-consent="accept">Accept</button>
        </div>
      </div>
    `;

    const closeButtons = banner.querySelectorAll(".cookie-consent__close, [data-consent='dismiss']");
    closeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setConsentValue(CONSENT_DISMISSED);
        dispatchConsentEvent(CONSENT_DISMISSED);
        closeBanner();
      });
    });

    const acceptButton = banner.querySelector("[data-consent='accept']");
    acceptButton.addEventListener("click", () => {
      setConsentValue(CONSENT_ACCEPTED);
      dispatchConsentEvent(CONSENT_ACCEPTED);
      closeBanner();
    });

    return banner;
  }

  window.rumbleCookieConsent = {
    storageKey: STORAGE_KEY,
    acceptedValue: CONSENT_ACCEPTED,
    dismissedValue: CONSENT_DISMISSED,
    getValue: getConsentValue,
    hasAnalyticsConsent() {
      return getConsentValue() === CONSENT_ACCEPTED;
    },
    reset() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        return;
      }
      initCookieConsent();
    },
    show() {
      injectStyles();
      document.body.appendChild(buildBanner());
    },
  };

  function initCookieConsent() {
    if (getConsentValue()) return;
    injectStyles();
    document.body.appendChild(buildBanner());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCookieConsent);
  } else {
    initCookieConsent();
  }
})();
