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
        if(!response.ok || data.ok === false){
          throw new Error(data.error || `Request failed (${response.status})`);
        }

        setStatus(status, "Thanks. Your enquiry has been submitted.", true, false);
        if(typeof showToast === "function") showToast("Thanks. Your enquiry has been submitted.");
        rememberSubmission(fingerprint);
        trackLead(payload);
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
  payload.idempotency_key = createIdempotencyKey(payload);

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

function createIdempotencyKey(payload){
  const source = getSubmissionFingerprint(payload);
  let hash = 0;
  for(let index = 0; index < source.length; index += 1){
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return `${Date.now().toString(36)}-${Math.abs(hash).toString(36)}`;
}

function trackLead(payload){
  const leadData = {
    enquiry_type: payload.enquiry_type || "unknown",
    preferred_model: payload.preferred_model || "",
    page: payload.page || window.location.href,
  };

  if(window.rumbleAnalytics && typeof window.rumbleAnalytics.trackLead === "function"){
    window.rumbleAnalytics.trackLead(leadData);
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "rumble_lead_submit",
    ...leadData,
  });
}
