// Runs before GTM on every page. v2 analytics choices never grant advertising consent.
(function(){
  var STORAGE_KEY = "rumble_cookie_consent_v3";
  var memoryChoice = null;
  window.dataLayer = window.dataLayer || [];

  function getChoice(){
    if(memoryChoice) return { ...memoryChoice };
    try{
      var choice = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(choice && choice.version === 3 && typeof choice.analytics === "boolean" && typeof choice.marketing === "boolean"){
        return { version: 3, analytics: choice.analytics, marketing: choice.marketing };
      }
    }catch(error){ /* Storage may be unavailable. Default to denied. */ }
    return null;
  }

  function consentSettings(choice){
    return {
      analytics_storage: choice?.analytics ? "granted" : "denied",
      ad_storage: choice?.marketing ? "granted" : "denied",
      ad_user_data: choice?.marketing ? "granted" : "denied",
      ad_personalization: choice?.marketing ? "granted" : "denied",
      functionality_storage: "granted",
      security_storage: "granted"
    };
  }

  function gtag(){ window.dataLayer.push(arguments); }
  window.rumbleConsent = {
    storageKey: STORAGE_KEY,
    getChoice,
    setChoice(analytics, marketing){
      memoryChoice = { version: 3, analytics: analytics === true, marketing: marketing === true };
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryChoice)); }catch(error){ /* Keep this page's choice in memory. */ }
      // Consent update precedes the event that GTM can use to initialise allowed tags.
      gtag("consent", "update", consentSettings(memoryChoice));
      window.dataLayer.push({
        event: "rumble_consent_update",
        analytics_consent: memoryChoice.analytics,
        marketing_consent: memoryChoice.marketing
      });
      window.dispatchEvent(new CustomEvent("rumble-cookie-consent", { detail: { ...memoryChoice } }));
    }
  };
  gtag("consent", "default", consentSettings(getChoice()));
})();
