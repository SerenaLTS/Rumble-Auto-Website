const GA_MEASUREMENT_ID = "G-VJR5VF2KJP";

(function initRumbleAnalytics() {
  let initialized = false;
  const hasValidId = /^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID) && GA_MEASUREMENT_ID !== "G-XXXXXXXXXX";

  const analyticsApi = {
    ready: false,
    measurementId: GA_MEASUREMENT_ID,
    track(eventName, params = {}) {
      if (!this.ready || typeof window.gtag !== "function") return;
      window.gtag("event", eventName, params);
    },
    trackLead(extra = {}) {
      this.track("generate_lead", {
        form_name: "enquiry_form",
        page_location: window.location.href,
        page_title: document.title,
        ...extra,
      });
    },
  };

  window.rumbleAnalytics = analyticsApi;

  function initGoogleAnalytics() {
    if (initialized || !hasValidId) return;
    initialized = true;

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID;
    document.head.appendChild(script);

    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      anonymize_ip: true,
      page_title: document.title,
      page_location: window.location.href,
    });

    analyticsApi.ready = true;
  }

  if (!hasValidId) {
    console.warn("GA4 disabled: replace G-XXXXXXXXXX in analytics.js with your real Measurement ID.");
    return;
  }

  if (window.rumbleCookieConsent && window.rumbleCookieConsent.hasAnalyticsConsent()) {
    initGoogleAnalytics();
  }

  window.addEventListener("rumble-cookie-consent", (event) => {
    if (event.detail && event.detail.value === "accepted") {
      initGoogleAnalytics();
    }
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;

    const href = link.getAttribute("href") || "";
    const absoluteHref = link.href || href;
    const label = (link.textContent || "").trim().slice(0, 120);

    if (href.startsWith("tel:")) {
      analyticsApi.track("contact_click", {
        contact_method: "phone",
        link_url: absoluteHref,
        link_text: label,
      });
      return;
    }

    if (href.startsWith("mailto:")) {
      analyticsApi.track("contact_click", {
        contact_method: "email",
        link_url: absoluteHref,
        link_text: label,
      });
      return;
    }

    if (/\.pdf($|[?#])/i.test(href)) {
      analyticsApi.track("file_download", {
        file_name: href.split("/").pop() || href,
        file_url: absoluteHref,
        link_text: label,
      });
    }
  });
})();
