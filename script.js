const revealItems = document.querySelectorAll("[data-reveal]");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

revealItems.forEach((item) => revealObserver.observe(item));

const siteHeader = document.querySelector(".site-header");
const navToggle = document.querySelector(".nav-toggle");
const mainNavigation = document.getElementById("mainNavigation");

function setNavigationOpen(isOpen) {
  if (!siteHeader || !navToggle) return;

  siteHeader.classList.toggle("menu-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
}

if (siteHeader && navToggle && mainNavigation) {
  navToggle.addEventListener("click", () => {
    setNavigationOpen(!siteHeader.classList.contains("menu-open"));
  });

  mainNavigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setNavigationOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setNavigationOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (!siteHeader.classList.contains("menu-open") || siteHeader.contains(event.target)) return;
    setNavigationOpen(false);
  });
}

function analyticsVisitorId() {
  const storageKey = "djai-analytics-visitor";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const visitorId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  window.localStorage.setItem(storageKey, visitorId);
  return visitorId;
}

function analyticsDeviceType() {
  const width = window.innerWidth;
  if (width <= 767) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}

function analyticsReferrerDomain() {
  if (!document.referrer) return "direct";
  try {
    const host = new URL(document.referrer).hostname;
    return host === window.location.hostname ? "direct" : host;
  } catch (error) {
    return "direct";
  }
}

const analyticsEndpoint = "/api/analytics/track";
const usesStaticPages = window.location.hostname === "djai.dc365.online" || window.location.hostname.endsWith(".github.io");

function trackWebsiteVisit() {
  if (document.body.classList.contains("portal-body") || navigator.doNotTrack === "1") return Promise.resolve();

  return fetch(analyticsEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      visitor_id: analyticsVisitorId(),
      page_path: window.location.pathname,
      referrer_domain: analyticsReferrerDomain(),
      device_type: analyticsDeviceType(),
      language: navigator.language,
    }),
  }).catch(() => {});
}

function updateFooterVisitorCount() {
  const counter = document.getElementById("footerVisitorCount");
  if (!counter) return;

  fetch("/api/analytics/count")
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then(({ visitors }) => {
      counter.textContent = new Intl.NumberFormat("en-US").format(Number(visitors || 0));
      counter.setAttribute("aria-label", `${counter.textContent} website visitors`);
    })
    .catch(() => { counter.textContent = "—"; });
}

if (usesStaticPages) {
  document.getElementById("footerVisitorCount")?.remove();
} else {
  Promise.resolve().then(trackWebsiteVisit).catch(() => {}).finally(updateFooterVisitorCount);
}

// Keep the Training gallery in the same layout container as the portfolio tabs.
const trainingPanel = document.querySelector("#training");
const portfolioSection = document.querySelector("#portfolio");
if (trainingPanel && portfolioSection) {
  portfolioSection.append(trainingPanel);
}

const tabs = document.querySelectorAll(".tab-button");
const panels = document.querySelectorAll(".portfolio-panel");

function showPortfolioTab(tab, updateUrl = true) {
  const target = tab.dataset.target;

  tabs.forEach((button) => {
    const isActive = button === tab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    const isActive = panel.id === target;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });

  if (updateUrl) {
    window.history.replaceState(null, "", `#portfolio-${target}`);
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => showPortfolioTab(tab));
});

const sharedPortfolioTab = window.location.hash.replace("#portfolio-", "");
const sharedTab = Array.from(tabs).find((tab) => tab.dataset.target === sharedPortfolioTab);
if (sharedTab) {
  showPortfolioTab(sharedTab, false);
  requestAnimationFrame(() => {
    portfolioSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

const cvDownloadButton = document.querySelector("[data-cv-download]");

if (cvDownloadButton) {
  cvDownloadButton.addEventListener("click", async (event) => {
    event.preventDefault();

    const passcode = window.prompt("Enter passcode to download Full CV");

    if (!passcode) return;

    if (usesStaticPages) {
      if (passcode.trim() !== "8396") {
        window.alert("Passcode is incorrect.");
        return;
      }

      const link = document.createElement("a");
      link.href = cvDownloadButton.href;
      link.download = cvDownloadButton.download || "Chatchai-Suthapakti-Full-CV.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    cvDownloadButton.classList.add("is-loading");
    cvDownloadButton.setAttribute("aria-busy", "true");

    try {
      const response = await fetch("/.netlify/functions/download-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      if (response.status === 401) {
        window.alert("Passcode is incorrect.");
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to download CV.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Chatchai-Suthapakti-Full-CV.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      window.alert("Sorry, the CV download is unavailable right now.");
    } finally {
      cvDownloadButton.classList.remove("is-loading");
      cvDownloadButton.removeAttribute("aria-busy");
    }
  });
}

const certificateSection = document.getElementById("speaker-certificates");
const certificateTrack = document.querySelector("[data-certificate-track]");
const certificateSlides = certificateTrack ? Array.from(certificateTrack.querySelectorAll(".certificate-slide")) : [];
const certificateDots = Array.from(document.querySelectorAll("[data-certificate-index]"));
const certificateCount = document.querySelector("[data-certificate-count]");
let activeCertificateIndex = 0;
let certificateScrollFrame = 0;

if (certificateSection && certificateTrack && certificateSlides.length) {
  // Hash-based opening remains available even if JavaScript cannot initialize.
  document.body.append(certificateSection);
  const certificateOpener = document.querySelector(".speaker-cert-btn");
  const certificateClose = certificateSection.querySelector(".certificate-close");
  const certificatePanel = certificateSection.querySelector(".certificate-panel");
  const backgroundInertState = new Map();
  let certificateModalOpen = false;
  const previousButton = certificateSection.querySelector("[data-certificate-prev]");
  const nextButton = certificateSection.querySelector("[data-certificate-next]");

  function syncCertificateModal() {
    const isOpen = window.location.hash === "#speaker-certificates";
    if (isOpen === certificateModalOpen) return;
    certificateModalOpen = isOpen;
    document.body.classList.toggle("certificates-open", isOpen);
    if (isOpen) {
      Array.from(document.body.children).forEach((element) => {
        if (element === certificateSection || element.tagName === "SCRIPT") return;
        backgroundInertState.set(element, element.inert);
        element.inert = true;
      });
      requestAnimationFrame(() => {
        if (!certificateModalOpen) return;
        showCertificate(0, "auto");
        certificateClose?.focus({ preventScroll: true });
      });
    } else {
      backgroundInertState.forEach((wasInert, element) => { element.inert = wasInert; });
      backgroundInertState.clear();
      certificateOpener?.focus({ preventScroll: true });
    }
  }

  function closeCertificateModal() {
    window.location.hash = "speaker";
    syncCertificateModal();
  }

  window.addEventListener("hashchange", syncCertificateModal);
  certificateSection.addEventListener("click", (event) => {
    if (certificatePanel && !certificatePanel.contains(event.target)) closeCertificateModal();
  });
  certificateSection.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCertificateModal();
    } else if (event.key === "Tab") {
      const focusable = Array.from(certificateSection.querySelectorAll("a[href]:not([tabindex='-1']), button, [tabindex='0']"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });

  function updateCertificateState(index) {
    activeCertificateIndex = index;
    certificateSlides.forEach((slide, slideIndex) => {
      slide.setAttribute("aria-label", `${slideIndex + 1} of ${certificateSlides.length}`);
    });
    certificateDots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === activeCertificateIndex;
      dot.classList.toggle("is-active", isActive);
      if (isActive) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    if (certificateCount) {
      const current = String(activeCertificateIndex + 1).padStart(2, "0");
      const total = String(certificateSlides.length).padStart(2, "0");
      certificateCount.textContent = `${current} / ${total}`;
    }
  }

  function showCertificate(index, behavior = "smooth") {
    const validIndex = Number.isInteger(index) ? index : 0;
    const nextIndex = (validIndex + certificateSlides.length) % certificateSlides.length;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nextSlide = certificateSlides[nextIndex];
    certificateTrack.scrollTo({
      left: nextSlide.getBoundingClientRect().left - certificateTrack.getBoundingClientRect().left + certificateTrack.scrollLeft,
      behavior: reducedMotion ? "auto" : behavior,
    });
    updateCertificateState(nextIndex);
  }

  previousButton?.addEventListener("click", () => showCertificate(activeCertificateIndex - 1));
  nextButton?.addEventListener("click", () => showCertificate(activeCertificateIndex + 1));

  certificateDots.forEach((dot) => {
    dot.addEventListener("click", () => showCertificate(Number(dot.dataset.certificateIndex)));
  });

  certificateTrack.addEventListener("scroll", () => {
    if (certificateScrollFrame) cancelAnimationFrame(certificateScrollFrame);
    certificateScrollFrame = requestAnimationFrame(() => {
      if (!certificateTrack.clientWidth) return;
      const index = Math.round(certificateTrack.scrollLeft / certificateTrack.clientWidth);
      const nextIndex = Math.max(0, Math.min(certificateSlides.length - 1, index));
      if (nextIndex !== activeCertificateIndex) updateCertificateState(nextIndex);
    });
  }, { passive: true });

  certificateTrack.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showCertificate(activeCertificateIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showCertificate(activeCertificateIndex + 1);
    }
  });

  updateCertificateState(0);
  syncCertificateModal();
}

const canvas = document.getElementById("signalCanvas");
const ctx = canvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let width = 0;
let height = 0;
let nodes = [];
let rafId = null;

function resizeCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const count = Math.max(34, Math.min(86, Math.floor(width / 18)));
  nodes = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    r: Math.random() * 1.8 + 0.8,
  }));
}

function drawNetwork() {
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 1;

  nodes.forEach((node, index) => {
    node.x += node.vx;
    node.y += node.vy;

    if (node.x < -20) node.x = width + 20;
    if (node.x > width + 20) node.x = -20;
    if (node.y < -20) node.y = height + 20;
    if (node.y > height + 20) node.y = -20;

    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 12);
    gradient.addColorStop(0, "rgba(39, 230, 255, 0.9)");
    gradient.addColorStop(1, "rgba(39, 230, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r * 4, 0, Math.PI * 2);
    ctx.fill();

    for (let j = index + 1; j < nodes.length; j += 1) {
      const other = nodes[j];
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 145) {
        const alpha = (1 - distance / 145) * 0.22;
        ctx.strokeStyle = `rgba(39, 230, 255, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(other.x, other.y);
        ctx.stroke();
      }
    }
  });

  rafId = requestAnimationFrame(drawNetwork);
}

if (!prefersReducedMotion && canvas && ctx) {
  resizeCanvas();
  drawNetwork();
  window.addEventListener("resize", () => {
    cancelAnimationFrame(rafId);
    resizeCanvas();
    drawNetwork();
  });
}
