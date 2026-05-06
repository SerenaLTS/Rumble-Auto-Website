console.log("ENQUIRY SCRIPT LOADED ✅");

const API_URL = "https://api.rumbleauto.com.au";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("enquiryForm");
  console.log("FORM FOUND:", !!form);

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("SUBMIT INTERCEPTED ✅");

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    payload.page = location.href;

    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));
    console.log("API RESULT:", r.status, data);

    if (r.ok && data.ok && window.rumbleAnalytics) {
      window.rumbleAnalytics.trackLead({
        enquiry_type: payload.enquiry_type || "unknown",
        preferred_model: payload.preferred_model || "",
      });
    }

    alert(r.ok && data.ok ? "Submitted ✅" : ("Failed: " + (data.error || r.status)));
  });
});
