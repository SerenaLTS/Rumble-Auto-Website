(() => {
  const consent = window.rumbleConsent;
  if(!consent) return;

  function saveChoice(analytics, marketing){
    consent.setChoice(analytics, marketing);
    closeBanner();
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
        width:min(460px, calc(100vw - 24px));
        max-height:calc(100dvh - 24px);
        overflow-y:auto;
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
            Essential storage keeps this website working. With your permission, analytics helps us
            understand visits, and advertising tools from Google and Meta measure enquiries and
            personalise ads. Advertising consent also allows us to share hashed contact details
            from successful enquiries for matching. You can change your choice in Cookie settings.
          </div>
          <button class="cookie-consent__close" type="button" aria-label="Reject optional tracking and close">&times;</button>
        </div>
        <div class="cookie-consent__actions">
          <a class="cookie-consent__link" href="${location.pathname.endsWith("_mobile.html") ? "privacy-policy_mobile.html" : "privacy-policy.html"}">Privacy Policy</a>
          <a class="cookie-consent__link" href="${location.pathname.endsWith("_mobile.html") ? "cookie-policy_mobile.html" : "cookie-policy.html"}">Cookie Policy</a>
          <button class="cookie-consent__btn" type="button" data-consent="reject">Reject optional</button>
          <button class="cookie-consent__btn" type="button" data-consent="analytics">Analytics only</button>
          <button class="cookie-consent__btn cookie-consent__btn--primary" type="button" data-consent="accept">Accept all</button>
        </div>
      </div>
    `;

    banner.querySelectorAll(".cookie-consent__close, [data-consent='reject']").forEach(button => {
      button.addEventListener("click", () => saveChoice(false, false));
    });
    banner.querySelector("[data-consent='analytics']").addEventListener("click", () => saveChoice(true, false));
    banner.querySelector("[data-consent='accept']").addEventListener("click", () => saveChoice(true, true));
    return banner;
  }

  window.rumbleCookieConsent = {
    storageKey: consent.storageKey,
    getValue(){
      const choice = consent.getChoice();
      return choice ? (choice.analytics ? "accepted" : "rejected") : null;
    },
    getChoice: consent.getChoice,
    hasAnalyticsConsent(){ return consent.getChoice()?.analytics === true; },
    hasMarketingConsent(){ return consent.getChoice()?.marketing === true; },
    reset(){
      consent.setChoice(false, false);
      this.show();
    },
    show(){
      injectStyles();
      document.body.appendChild(buildBanner());
    }
  };

  function initCookieConsent() {
    document.querySelectorAll(".footer-legal").forEach(footer => {
      if(footer.querySelector("[data-cookie-settings]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.cookieSettings = "true";
      button.textContent = "Cookie settings";
      button.style.cssText = "font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline";
      button.addEventListener("click", () => window.rumbleCookieConsent.show());
      footer.appendChild(button);
    });
    if (consent.getChoice()) return;
    injectStyles();
    document.body.appendChild(buildBanner());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCookieConsent);
  } else {
    initCookieConsent();
  }
})();
