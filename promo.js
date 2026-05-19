(function(){
  const STORAGE_KEY = "rumblePromoHideUntil";
  const HIDE_HOURS = 3;
  const HIDE_MS = HIDE_HOURS * 60 * 60 * 1000;

  function shouldShowPromo(){
    const hideUntil = localStorage.getItem(STORAGE_KEY);
    if(!hideUntil) return true;
    const hideUntilTs = Number(hideUntil);
    if(Number.isNaN(hideUntilTs)) return true;
    return Date.now() >= hideUntilTs;
  }

  function contactHref(){
    const path = window.location.pathname;
    if(path.endsWith("index.html") || path === "/" || path === "") return "#contact";
    if(path.includes("_mobile.html")) return "index_mobile.html#contact";
    return "index.html#contact";
  }

  function injectPromo(){
    if(document.getElementById("promoOverlay")) return document.getElementById("promoOverlay");

    const style = document.createElement("style");
    style.textContent = `
      .promo-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.72);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .25s ease,visibility .25s ease}
      .promo-overlay.is-open{opacity:1;visibility:visible;pointer-events:auto}
      .promo-modal{position:relative;width:min(92vw,720px);background:transparent;border:0;border-radius:16px;padding:0;box-shadow:none}
      .promo-close{position:absolute;top:10px;right:10px;z-index:3;width:42px;height:42px;border:0;border-radius:999px;background:rgba(15,23,42,.65);color:#fff;font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer}
      .promo-close:hover{background:rgba(15,23,42,.82)}
      .promo-poster-link{display:block;line-height:0}
      .promo-poster{display:block;width:100%;height:auto;max-height:88vh;object-fit:contain;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.4)}
      @media (max-width:768px){.promo-overlay{padding:14px}.promo-modal{width:min(100%,520px)}.promo-poster{max-height:84vh;border-radius:14px}.promo-close{top:8px;right:8px;width:38px;height:38px;font-size:20px}}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "promo-overlay";
    overlay.id = "promoOverlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="promo-modal" role="dialog" aria-modal="true" aria-label="Promotion">
        <button class="promo-close" id="promoClose" type="button" aria-label="Close promotion">&times;</button>
        <a href="${contactHref()}" class="promo-poster-link">
          <img src="assets/promotion-poster.png" alt="Special promotion from RUMBLE Auto" class="promo-poster">
        </a>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  document.addEventListener("DOMContentLoaded", function(){
    if(!shouldShowPromo()) return;

    const overlay = injectPromo();
    const closeBtn = overlay.querySelector("#promoClose");
    const posterLink = overlay.querySelector(".promo-poster-link");

    function openPromo(){
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closePromo(){
      localStorage.setItem(STORAGE_KEY, String(Date.now() + HIDE_MS));
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    setTimeout(openPromo, 400);

    closeBtn.addEventListener("click", closePromo);
    posterLink.addEventListener("click", closePromo);
    overlay.addEventListener("click", function(event){
      if(event.target === overlay) closePromo();
    });
    document.addEventListener("keydown", function(event){
      if(event.key === "Escape" && overlay.classList.contains("is-open")) closePromo();
    });
  });
})();
