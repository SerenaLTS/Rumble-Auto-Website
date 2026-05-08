const modelData = {
  g5s4x2cargo: {
    title: "SITRAK-G5S 4x2 Cargo Cab & Chassis",
    series: "G5 Series",
    image: "assets/models/g5s-4x2-cargo-cab-chassis.avif",
    desc: "Flexible cargo configuration for transport, construction and municipal applications.",
    brochure: "assets/brochures/g5s-4x2-cargo-cab-chassis.pdf",
    specs: [["Configuration","4x2"],["Application","Cargo"],["Location","Sydney NSW"]]
  },
  g5s6x4cargo: {
    title: "SITRAK-G5S 6x4 Cargo Cab & Chassis",
    series: "G5 Series",
    image: "assets/models/g5s-6x4-cargo-cab-chassis.avif",
    desc: "Flexible cargo configuration for transport, construction and municipal applications.",
    brochure: "assets/brochures/g5s-6x4-cargo-cab-chassis.pdf",
    specs: [["Configuration","6x4"],["Application","Cargo"],["Location","Sydney NSW"]]
  },
  g5s8x4cargo: {
    title: "SITRAK-G5S 8x4 Cargo Cab & Chassis",
    series: "G5 Series",
    image: "assets/models/g5s-8x4-cargo-cab-chassis.avif",
    desc: "Flexible cargo configuration for transport, construction and municipal applications.",
    brochure: "assets/brochures/g5s-8x4-cargo-cab-chassis.pdf",
    specs: [["Configuration","8x4"],["Application","Cargo"],["Location","Sydney NSW"]]
  },
  g5s8x4mixer: {
    title: "SITRAK-G5S 8x4 Mixer Cab & Chassis",
    series: "G5 Series",
    image: "assets/models/g5s-8x4-mixer-cab-chassis.avif",
    desc: "Mixer cab and chassis configuration for construction and concrete applications.",
    brochure: "assets/brochures/g5s-8x4-mixer-cab-chassis.pdf",
    specs: [["Configuration","8x4"],["Application","Mixer"],["Series","G5S"]]
  },
  g5s6x4tipper: {
    title: "SITRAK G5S 6x4 Tipper Cab & Chassis",
    series: "G5 Series",
    image: "assets/models/g5s-6x4-tipper-cab-chassis.avif",
    desc: "Built for Construction, Quarry & Heavy-Duty Tipper Applications. Purpose-engineered for construction, infrastructure and heavy material transport applications across Australia.",
    brochure: "assets/brochures/g5s-6x4-tipper-cab-chassis.pdf",
    specs: [["Engine","MC07H.33-61"],["Displacement","7.36L"],["Max Power","240 kW @ 2200 rpm"],["Max Torque","1322 Nm @ 1200-1700 rpm"],["GVM","25,000 kg"],["Transmission","Allison 3200 Automatic"]]
  },
  g5s8x4tipper: {
    title: "SITRAK G5S 8x4 Tipper Cab & Chassis",
    series: "G5 Series",
    image: "assets/models/g5s-8x4-tipper-cab-chassis.avif",
    desc: "Heavy-duty tipper cab and chassis configuration for construction, quarry and material transport applications.",
    brochure: "assets/brochures/g5s-8x4-tipper-cab-chassis.pdf",
    specs: [["Configuration","8x4"],["Application","Tipper"],["Series","G5S"]]
  },
  g7s6x4prime: {
    title: "SITRAK-G7S 6x4 Prime Mover",
    series: "G7 Series",
    image: "assets/models/g7s-6x4-prime-mover.avif",
    desc: "Long-haul performance for Sydney NSW fleet operators requiring prime mover solutions.",
    brochure: "assets/brochures/g7s-6x4-prime-mover.pdf",
    specs: [["Configuration","6x4"],["Application","Prime Mover"],["Series","G7S"]]
  },
  g7s6x4tipper: {
    title: "SITRAK G7S 6x4 Tipper Cab & Chassis",
    series: "G7 Series",
    image: "assets/models/g7s-6x4-tipper-cab-chassis.avif",
    desc: "Heavy-Duty Engineering for Construction & Quarry Operations. Powered by a 12.42L high-output engine and matched with a ZF TraXon automated transmission.",
    brochure: "assets/brochures/g7s-6x4-tipper-cab-chassis.pdf",
    specs: [["Engine","540 HP MC13.54-61"],["Displacement","12.42L"],["Max Power","400 kW @ 1800 rpm"],["Max Torque","2500 Nm @ 1000-1400 rpm"],["GVM","25,000 kg"],["Transmission","ZF 12TX2621TD"]]
  },
  g7s8x4tipper: {
    title: "SITRAK G7S 8x4 Tipper Cab & Chassis",
    series: "G7 Series",
    image: "assets/models/g7s-8x4-tipper-cab-chassis.avif",
    desc: "Heavy-duty 8x4 tipper configuration for operators requiring G7 Series performance and construction versatility.",
    brochure: "assets/brochures/g7s-8x4-tipper-cab-chassis.pdf",
    specs: [["Configuration","8x4"],["Application","Tipper"],["Series","G7S"]]
  },
  c9h6x4prime: {
    title: "SITRAK-C9H 6x4 Prime Mover",
    series: "C9 Series",
    image: "assets/models/c9h-6x4-prime-mover.avif",
    desc: "Premium heavy-duty model designed for interstate freight, high-load transport and demanding fleet work across NSW and Australia.",
    brochure: "assets/brochures/c9h-6x4-prime-mover.pdf",
    specs: [["Configuration","6x4"],["Application","Prime Mover"],["Series","C9H"]]
  }
};

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
  if(brochureLink) brochureLink.href = data.brochure || "assets/brochures/sitrak-australia-overview.pdf";
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
      window.location.href = "index.html#contact";
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
    window.location.href = "index.html#contact";
  });
});

applyStoredEnquiry();
initSeriesCarousel();
