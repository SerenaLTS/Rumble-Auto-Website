(function(){
  var STORAGE_KEY = "rumble_cookie_consent_v2";
  var ACCEPTED = "accepted";

  window.dataLayer = window.dataLayer || [];
  function gtag(){
    window.dataLayer.push(arguments);
  }

  var consent = null;
  try{
    consent = localStorage.getItem(STORAGE_KEY);
  }catch(error){
    consent = null;
  }

  gtag("consent", "default", {
    ad_storage: "denied",
    analytics_storage: consent === ACCEPTED ? "granted" : "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    functionality_storage: "granted",
    security_storage: "granted"
  });
})();
