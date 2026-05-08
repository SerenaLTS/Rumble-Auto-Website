const API_URL = "https://api.rumbleauto.com.au";

document.addEventListener("DOMContentLoaded", () => {
  const forms = document.querySelectorAll("form.js-form, form#enquiryForm");
  const uniqueForms = [...new Set(forms)];

  uniqueForms.forEach(form => {
    if(form.dataset.enquiryReady === "true") return;
    form.dataset.enquiryReady = "true";

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const status = form.querySelector(".form-status");
      const submitButton = form.querySelector("[type='submit']");
      const originalButtonText = submitButton?.textContent || "";

      setStatus(status, "Sending your enquiry...", true, false);
      if(submitButton){
        submitButton.disabled = true;
        submitButton.textContent = "SENDING...";
      }

      const payload = buildPayload(form);

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
        if(window.rumbleAnalytics){
          window.rumbleAnalytics.trackLead({
            enquiry_type: payload.enquiry_type || "unknown",
            preferred_model: payload.preferred_model || "",
          });
        }
        form.reset();
      }catch(error){
        console.error("Enquiry submit failed:", error);
        setStatus(status, "Sorry, your enquiry could not be sent. Please call or email us directly.", true, true);
        if(typeof showToast === "function") showToast("Enquiry failed. Please call or email us directly.");
      }finally{
        if(submitButton){
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      }
    });
  });
});

function buildPayload(form){
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  if(!payload.enquiry_type && payload.topic) payload.enquiry_type = payload.topic;
  if(!payload.preferred_model && payload.model) payload.preferred_model = payload.model;

  payload.page = window.location.href;
  payload.page_title = document.title;
  payload.submitted_at = new Date().toISOString();

  delete payload.topic;
  delete payload.model;

  return payload;
}

function setStatus(status, message, visible, isError){
  if(!status) return;
  status.textContent = message;
  status.classList.toggle("is-visible", visible);
  status.classList.toggle("is-error", isError);
}
