(function(){
  const MOBILE_MAX_WIDTH = 820;
  const DESKTOP_MIN_WIDTH = 1024;

  const desktopToMobile = {
    "models.html": "models_mobile.html",
    "services.html": "services_mobile.html",
    "fleet-finance.html": "fleet-finance_mobile.html",
    "news1.html": "news1_mobile.html",
    "g5s-4x2-cargo-cab-chassis.html": "g5s-4x2-cargo-cab-chassis_mobile.html",
    "g5s-6x4-cargo-cab-chassis.html": "g5s-6x4-cargo-cab-chassis_mobile.html",
    "g5s-8x4-cargo-cab-chassis.html": "g5s-8x4-cargo-cab-chassis_mobile.html",
    "g5s-8x4-mixer-cab-chassis.html": "g5s-8x4-mixer-cab-chassis_mobile.html",
    "g5s-6x4-tipper-cab-chassis.html": "g5s-6x4-tipper-cab-chassis_mobile.html",
    "g5s-8x4-tipper-cab-chassis.html": "g5s-8x4-tipper-cab-chassis_mobile.html",
    "g7s-6x4-prime-mover.html": "g7s-6x4-prime-mover_mobile.html",
    "g7s-6x4-tipper-cab-chassis.html": "g7s-6x4-tipper-cab-chassis_mobile.html",
    "g7s-8x4-tipper-cab-chassis.html": "g7s-8x4-tipper-cab-chassis_mobile.html",
    "c9h-6x4-prime-mover.html": "c9h-6x4-prime-mover_mobile.html",
    "privacy-policy.html": "mobile_privacy-policy.html",
    "cookie-policy.html": "cookie-policy_mobile.html"
  };

  const mobileToDesktop = Object.fromEntries(
    Object.entries(desktopToMobile).map(([desktop, mobile]) => [mobile, desktop])
  );

  const params = new URLSearchParams(window.location.search);
  const forcedView = params.get("view");
  const pathname = window.location.pathname;
  const currentFile = pathname.split("/").pop() || "index.html";
  const currentPage = currentFile || "index.html";
  const isRootIndex = pathname.endsWith("/");

  function isMobileDevice(){
    const ua = navigator.userAgent || "";
    const uaDataMobile = navigator.userAgentData && navigator.userAgentData.mobile === true;
    const mobileUA = /Android|iPhone|iPod|Windows Phone|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    const smallScreen = Math.min(window.screen.width || window.innerWidth, window.screen.height || window.innerHeight) <= MOBILE_MAX_WIDTH;
    const smallViewport = window.matchMedia(`(max-width:${MOBILE_MAX_WIDTH}px)`).matches;
    return Boolean(uaDataMobile || mobileUA || smallScreen || smallViewport);
  }

  function isDesktopViewport(){
    return window.matchMedia(`(min-width:${DESKTOP_MIN_WIDTH}px)`).matches;
  }

  function targetUrl(targetFile, view){
    const base = isRootIndex ? pathname : pathname.slice(0, pathname.length - currentFile.length);
    const nextParams = new URLSearchParams(window.location.search);
    if(view) nextParams.set("view", view);
    else nextParams.delete("view");

    const query = nextParams.toString();
    return `${base}${targetFile}${query ? `?${query}` : ""}${window.location.hash}`;
  }

  function redirect(targetFile, view){
    if(!targetFile || targetFile === currentPage) return;
    window.location.replace(targetUrl(targetFile, view));
  }

  if(forcedView === "mobile"){
    redirect(desktopToMobile[currentPage], "mobile");
    return;
  }

  if(forcedView === "desktop"){
    redirect(mobileToDesktop[currentPage], "desktop");
    return;
  }

  if(desktopToMobile[currentPage] && isMobileDevice()){
    redirect(desktopToMobile[currentPage]);
    return;
  }

  if(mobileToDesktop[currentPage] && !isMobileDevice() && isDesktopViewport()){
    redirect(mobileToDesktop[currentPage]);
  }
})();
