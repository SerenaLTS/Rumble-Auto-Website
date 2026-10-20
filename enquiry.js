const API_URL = "https://api.rumbleauto.com.au";
const DUPLICATE_WINDOW_MS = 30000;
const MIN_SUBMIT_MS = 1200;

document.addEventListener("DOMContentLoaded", () => {
  const forms = document.querySelectorAll("form.js-form, form#enquiryForm");
  const uniqueForms = [...new Set(forms)];

  uniqueForms.forEach(form => {
    if(form.dataset.enquiryReady === "true") return;
    form.dataset.enquiryReady = "true";
    form.dataset.enquiryStartedAt = String(Date.now());
    addHoneypotField(form);

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const status = form.querySelector(".form-status");
      const submitButton = form.querySelector("[type='submit']");
      const originalButtonText = submitButton?.textContent || "";
      const payload = buildPayload(form);
      const marketingAtSubmit = window.rumbleConsent?.getChoice()?.marketing === true;
      const fingerprint = getSubmissionFingerprint(payload);

      if(isLikelyBot(form)){
        setStatus(status, "Sorry, your enquiry could not be sent. Please call or email us directly.", true, true);
        return;
      }

      if(!isValidContact(payload.contact)){
        setStatus(status, "Please enter a valid phone number or email address.", true, true);
        return;
      }

      if(form.dataset.enquirySubmitting === "true" || isRecentDuplicate(fingerprint)){
        setStatus(status, "Your enquiry is already being submitted.", true, false);
        return;
      }

      form.dataset.enquirySubmitting = "true";
      setStatus(status, "Sending your enquiry...", true, false);
      if(submitButton){
        submitButton.disabled = true;
        submitButton.textContent = "SENDING...";
      }

      try{
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));
        if(!response.ok || data.ok !== true){
          throw new Error(data.error || `Request failed (${response.status})`);
        }

        setStatus(status, "Thanks. Your enquiry has been submitted.", true, false);
        if(typeof showToast === "function") showToast("Thanks. Your enquiry has been submitted.");
        rememberSubmission(fingerprint);
        // Tracking errors must never turn a saved enquiry into a visible submission failure.
        void trackLead(payload, marketingAtSubmit).catch(() => console.warn("Lead tracking unavailable"));
        form.reset();
      }catch(error){
        console.error("Enquiry submit failed:", error);
        setStatus(status, "Sorry, your enquiry could not be sent. Please call or email us directly.", true, true);
        if(typeof showToast === "function") showToast("Enquiry failed. Please call or email us directly.");
      }finally{
        form.dataset.enquirySubmitting = "false";
        if(submitButton){
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      }
    });
  });
});

function addHoneypotField(form){
  if(form.querySelector("[name='company_website']")) return;

  const wrapper = document.createElement("div");
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.style.position = "absolute";
  wrapper.style.left = "-9999px";
  wrapper.style.width = "1px";
  wrapper.style.height = "1px";
  wrapper.style.overflow = "hidden";
  wrapper.innerHTML = '<label>Company website<input type="text" name="company_website" tabindex="-1" autocomplete="off"></label>';
  form.appendChild(wrapper);
}

function buildPayload(form){
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  if(!payload.enquiry_type && payload.topic) payload.enquiry_type = payload.topic;
  if(!payload.preferred_model && payload.model) payload.preferred_model = payload.model;

  payload.page = window.location.href;
  payload.page_title = document.title;
  payload.submitted_at = new Date().toISOString();
  payload.idempotency_key = createIdempotencyKey();
  payload.event_id = payload.idempotency_key;

  delete payload.topic;
  delete payload.model;
  delete payload.company_website;

  return payload;
}

function isLikelyBot(form){
  const honeypot = form.querySelector("[name='company_website']");
  const startedAt = Number(form.dataset.enquiryStartedAt || 0);
  const submittedTooFast = Date.now() - startedAt < MIN_SUBMIT_MS;
  return Boolean(honeypot?.value || submittedTooFast);
}

function isValidContact(contact){
  const value = String(contact || "").trim();
  const hasEmailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const digitCount = (value.match(/\d/g) || []).length;
  return hasEmailShape || digitCount >= 6;
}

function setStatus(status, message, visible, isError){
  if(!status) return;
  status.textContent = message;
  status.classList.toggle("is-visible", visible);
  status.classList.toggle("is-error", isError);
}

function getSubmissionFingerprint(payload){
  return [
    payload.name || "",
    payload.contact || "",
    payload.enquiry_type || "",
    payload.preferred_model || "",
    payload.message || "",
    payload.page || "",
  ].map(value => String(value).trim().toLowerCase()).join("|");
}

function isRecentDuplicate(fingerprint){
  try{
    const record = JSON.parse(sessionStorage.getItem("rumble_last_enquiry") || "{}");
    return record.fingerprint === fingerprint && Date.now() - Number(record.timestamp || 0) < DUPLICATE_WINDOW_MS;
  }catch(error){
    return false;
  }
}

function rememberSubmission(fingerprint){
  try{
    sessionStorage.setItem("rumble_last_enquiry", JSON.stringify({
      fingerprint,
      timestamp: Date.now(),
    }));
  }catch(error){
    return;
  }
}

function createIdempotencyKey(){
  return crypto.randomUUID();
}

// Hashed matching data stays out of dataLayer, URLs, logs and browser storage.
// GTM reads it only through JS - Lead User Data -> rumbleAdsUserData.
const adsMatching = (() => {
  let current = null;
  let cleanupTimer;
  let consentRevision = 0;

  function clear(eventId){
    if(eventId && current?.eventId !== eventId) return;
    current = null;
    clearTimeout(cleanupTimer);
  }

  Object.defineProperty(window, "rumbleAdsUserData", {
    configurable: true,
    get(){
      if(window.rumbleConsent?.getChoice()?.marketing !== true || !current || Date.now() >= current.expiresAt){
        return {};
      }
      return { ...current.data };
    }
  });

  window.addEventListener("rumble-cookie-consent", () => {
    if(window.rumbleConsent?.getChoice()?.marketing !== true){
      consentRevision += 1;
      clear();
    }
  });

  return {
    getRevision: () => consentRevision,
    clear,
    expose(eventId, data){
      clear();
      current = { eventId, data, expiresAt: Date.now() + 10000 };
      cleanupTimer = setTimeout(() => clear(eventId), 10000);
    }
  };
})();

function normaliseMatchingContact(contact){
  const value = String(contact || "").trim().toLowerCase();
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){
    const [local, domain] = value.split("@");
    const email = /^(gmail\.com|googlemail\.com)$/.test(domain)
      ? `${local.replace(/\./g, "")}@${domain}` : value;
    return { field: "sha256_email_address", value: email };
  }

  // The form serves Australia. Only infer +61 for valid-length Australian numbers;
  // other countries must supply an explicit +country code or 00 prefix.
  if(!/^[+\d\s().-]+$/.test(value)) return null;
  let phone = value.replace(/[\s().-]/g, "");
  if(/^00[1-9]/.test(phone)) phone = `+${phone.slice(2)}`;
  if(/^0[23478]\d{8}$/.test(phone)) phone = `+61${phone.slice(1)}`;
  if(/^61[23478]\d{8}$/.test(phone)) phone = `+${phone}`;
  if(!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  return { field: "sha256_phone_number", value: phone };
}

async function prepareMatchingData(contact){
  const normalised = normaliseMatchingContact(contact);
  if(!normalised || !crypto.subtle) return {};
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalised.value));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return { [normalised.field]: hash };
}

async function trackLead(payload, marketingAtSubmit){
  const revision = adsMatching.getRevision();
  let matchingData = {};
  if(marketingAtSubmit && window.rumbleConsent?.getChoice()?.marketing === true){
    let timeout;
    try{
      // If hashing fails or stalls, standard conversion tracking must still proceed.
      matchingData = await Promise.race([
        prepareMatchingData(payload.contact),
        new Promise(resolve => { timeout = setTimeout(() => resolve({}), 1500); })
      ]);
    }catch(error){ /* Matching is optional; never fall back to exposing raw contact data. */ }
    finally{ clearTimeout(timeout); }
  }

  // Consent can change while the API or hashing is in flight.
  const choice = window.rumbleConsent?.getChoice();
  if(!choice?.analytics && !choice?.marketing) return;

  const leadData = {
    event_id: payload.event_id,
    transaction_id: payload.event_id,
    enquiry_type: payload.enquiry_type || "unknown",
    lead_type: payload.enquiry_type || "unknown",
    // Exclude free-text model/topic and URL queries, which may contain personal data.
    page_path: window.location.pathname,
    analytics_consent: choice.analytics === true,
    marketing_consent: choice.marketing === true,
  };

  window.dataLayer = window.dataLayer || [];
  if(!choice.marketing || revision !== adsMatching.getRevision()) matchingData = {};
  adsMatching.expose(payload.event_id, matchingData);
  try{
    window.dataLayer.push({
      event: "rumble_lead_submit",
      ...leadData,
      // GTM calls this after event tags finish. The TTL also clears data if GTM is unavailable.
      eventCallback: () => adsMatching.clear(payload.event_id),
      eventTimeout: 2000,
    });
  }catch(error){
    adsMatching.clear(payload.event_id);
    throw error;
  }
}
