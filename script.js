const modelData = window.RUMBLE_MODEL_DATA || {};

const toast = document.querySelector(".toast");
let activeTopic = "";
let toastTimer;

function showToast(message){
  if(!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function setEnquiry(topic, model){
  localStorage.setItem("rumbleTopic", topic || "General Enquiry");
  localStorage.setItem("rumbleModel", model || "");
}

function applyStoredEnquiry(){
  const topic = localStorage.getItem("rumbleTopic");
  const model = localStorage.getItem("rumbleModel");
  const topicSelect = document.querySelector(".js-topic");
  const modelInput = document.querySelector(".js-model");
  if(topicSelect && topic){
    [...topicSelect.options].forEach(option => {
      if(option.textContent === topic || option.value === topic) topicSelect.value = option.value;
    });
  }
  if(modelInput && model) modelInput.value = model;
}

function openModal(modelKey){
  const data = modelData[modelKey];
  const modal = document.getElementById("specModal");
  if(!data || !modal) return;
  activeTopic = data.title;
  modal.querySelector(".modal-img").src = data.image;
  modal.querySelector(".modal-img").alt = data.title;
  modal.querySelector(".modal-series").textContent = data.series;
  modal.querySelector(".modal-title").textContent = data.title;
  modal.querySelector(".modal-desc").textContent = data.desc;
  modal.querySelector(".modal-specs").innerHTML = data.specs.map(([label,value]) => `<div><span class="mini-label">${label}</span><strong>${value}</strong></div>`).join("");
  const brochureLink = modal.querySelector(".modal-brochure");
  if(brochureLink){
    brochureLink.hidden = !data.brochure;
    if(data.brochure) brochureLink.href = data.brochure;
    else brochureLink.removeAttribute("href");
  }
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
}

function openVideoModal(){
  const modal = document.getElementById("heroVideoModal");
  const video = modal?.querySelector(".video-modal-player");
  if(!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
  if(video && typeof video.play === "function"){
    video.currentTime = 0;
    video.play().catch(() => {});
  }
}

function resetVideoModal(){
  const video = document.querySelector(".video-modal-player");
  if(!video) return;
  if(typeof video.pause === "function"){
    video.pause();
    video.currentTime = 0;
    return;
  }
  if(video.tagName === "IFRAME"){
    video.src = video.src;
  }
}

function closeModals(){
  document.querySelectorAll(".modal").forEach(modal => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden","true");
  });
  resetVideoModal();
  document.body.style.overflow = "";
}

function initSeriesCarousel(){
  const root = document.getElementById("seriesCarousel");
  if(!root) return;
  const cards = Array.from(root.querySelectorAll(".carousel-card"));
  const prevButton = root.querySelector(".carousel-arrow-prev");
  const nextButton = root.querySelector(".carousel-arrow-next");
  const total = cards.length;
  if(total === 0) return;

  let active = Math.min(1, total - 1);
  let pointerDown = false;
  let dragStartX = 0;
  let dragDeltaX = 0;
  let activePointerId = null;
  let pressedCard = null;
  const dragThreshold = 60;

  function render(){
    cards.forEach((card, index) => {
      card.classList.remove("is-active", "is-prev", "is-next");
      if(index === active) card.classList.add("is-active");
      else if(index === (active - 1 + total) % total) card.classList.add("is-prev");
      else if(index === (active + 1) % total) card.classList.add("is-next");
      card.setAttribute("aria-hidden", index === active ? "false" : "true");
    });
  }

  function go(index){
    active = (index + total) % total;
    render();
  }

  function prev(){
    go(active - 1);
  }

  function next(){
    go(active + 1);
  }

  function stopDragging(){
    pointerDown = false;
    root.classList.remove("is-dragging");
    if(activePointerId !== null && root.hasPointerCapture?.(activePointerId)){
      root.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
  }

  function triggerSwipe(direction){
    stopDragging();
    if(direction > 0) prev();
    else next();
    setTimeout(() => { dragDeltaX = 0; }, 60);
  }

  prevButton?.addEventListener("click", prev);
  nextButton?.addEventListener("click", next);

  root.addEventListener("pointerdown", event => {
    if(event.target.closest("a,button")) return;
    pointerDown = true;
    dragStartX = event.clientX;
    dragDeltaX = 0;
    activePointerId = event.pointerId;
    pressedCard = event.target.closest(".carousel-card");
    root.classList.add("is-dragging");
    root.setPointerCapture?.(event.pointerId);
  });

  window.addEventListener("pointermove", event => {
    if(!pointerDown) return;
    dragDeltaX = event.clientX - dragStartX;
    if(dragDeltaX > dragThreshold) triggerSwipe(1);
    else if(dragDeltaX < -dragThreshold) triggerSwipe(-1);
  });

  function onPointerUp(){
    if(!pointerDown){
      pressedCard = null;
      return;
    }
    const finalDelta = dragDeltaX;
    const tappedCard = pressedCard;
    stopDragging();
    pressedCard = null;
    if(finalDelta > dragThreshold) prev();
    else if(finalDelta < -dragThreshold) next();
    else if(tappedCard?.classList.contains("is-prev")) prev();
    else if(tappedCard?.classList.contains("is-next")) next();
    setTimeout(() => { dragDeltaX = 0; }, 60);
  }

  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  root.tabIndex = 0;
  root.addEventListener("keydown", event => {
    if(event.key === "ArrowLeft"){
      event.preventDefault();
      prev();
    }
    if(event.key === "ArrowRight"){
      event.preventDefault();
      next();
    }
  });

  render();
}

document.querySelectorAll(".menu-toggle").forEach(button => {
  button.addEventListener("click", () => {
    const panel = document.querySelector(".mobile-panel");
    const isOpen = panel.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(isOpen));
  });
});

document.querySelectorAll(".mobile-panel a").forEach(link => {
  link.addEventListener("click", () => document.querySelector(".mobile-panel")?.classList.remove("is-open"));
});

document.querySelectorAll(".news-float-close").forEach(button => {
  button.addEventListener("click", () => {
    button.closest(".news-float")?.classList.add("is-hidden");
  });
});

document.querySelectorAll(".js-quote").forEach(button => {
  button.addEventListener("click", () => {
    const topic = button.dataset.topic || "General Enquiry";
    const model = button.dataset.model || "";
    setEnquiry(topic, model);
    if(document.querySelector("#contact")){
      applyStoredEnquiry();
      document.querySelector("#contact").scrollIntoView({behavior:"smooth"});
      showToast(`${topic} selected for your enquiry.`);
    }else if(document.querySelector(".js-form")){
      applyStoredEnquiry();
      document.querySelector(".js-form").scrollIntoView({behavior:"smooth"});
      showToast(`${topic} selected for this form.`);
    }else{
      window.location.href = "/#contact";
    }
  });
});

document.querySelectorAll(".js-specs").forEach(button => {
  button.addEventListener("click", () => openModal(button.dataset.modelKey));
});

document.querySelectorAll(".js-video-open").forEach(button => {
  button.addEventListener("click", openVideoModal);
  button.addEventListener("keydown", event => {
    if(event.key === "Enter" || event.key === " "){
      event.preventDefault();
      openVideoModal();
    }
  });
});

document.querySelectorAll(".modal-close").forEach(button => button.addEventListener("click", closeModals));
document.querySelectorAll(".modal").forEach(modal => modal.addEventListener("click", event => {
  if(event.target === modal) closeModals();
}));
document.addEventListener("keydown", event => {
  if(event.key === "Escape") closeModals();
});

document.querySelectorAll(".js-modal-quote").forEach(button => {
  button.addEventListener("click", () => {
    setEnquiry("Sales Enquiry", activeTopic);
    closeModals();
    window.location.href = "/#contact";
  });
});

applyStoredEnquiry();
initSeriesCarousel();
