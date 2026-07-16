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

const tabs = document.querySelectorAll(".tab-button");
const panels = document.querySelectorAll(".portfolio-panel");
const cinematicPasscodeDialog = document.getElementById("cinematicPasscodeDialog");
const cinematicPasscodeForm = document.getElementById("cinematicPasscodeForm");
const cinematicPasscodeInput = document.getElementById("cinematicPasscodeInput");
const cinematicPasscodeError = document.getElementById("cinematicPasscodeError");
const cinematicPasscodeCancel = document.getElementById("cinematicPasscodeCancel");
const cinematicPasscode = "1111";
const cinematicUnlockKey = "djai-cinematic-unlocked";
let pendingProtectedTab = null;

function showPortfolioTab(tab) {
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
}

function cinematicIsUnlocked() {
  return window.sessionStorage.getItem(cinematicUnlockKey) === "true";
}

function openCinematicPasscodeDialog(tab) {
  pendingProtectedTab = tab;
  cinematicPasscodeForm.reset();
  cinematicPasscodeError.textContent = "";
  cinematicPasscodeDialog.showModal();
  window.setTimeout(() => cinematicPasscodeInput.focus(), 0);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.target === "cinematic" && !cinematicIsUnlocked()) {
      openCinematicPasscodeDialog(tab);
      return;
    }

    showPortfolioTab(tab);
  });
});

if (cinematicPasscodeForm) {
  cinematicPasscodeForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (cinematicPasscodeInput.value !== cinematicPasscode) {
      cinematicPasscodeError.textContent = "Passcode is incorrect. Please try again.";
      cinematicPasscodeInput.select();
      return;
    }

    window.sessionStorage.setItem(cinematicUnlockKey, "true");
    const protectedTab = pendingProtectedTab;
    cinematicPasscodeDialog.close();
    if (protectedTab) showPortfolioTab(protectedTab);
    pendingProtectedTab = null;
  });

  cinematicPasscodeCancel.addEventListener("click", () => {
    cinematicPasscodeDialog.close();
    pendingProtectedTab = null;
  });

  cinematicPasscodeDialog.addEventListener("close", () => {
    pendingProtectedTab = null;
  });
}

const cvDownloadButton = document.querySelector("[data-cv-download]");

if (cvDownloadButton) {
  cvDownloadButton.addEventListener("click", async (event) => {
    event.preventDefault();

    const passcode = window.prompt("Enter passcode to download Full CV");

    if (!passcode) return;

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
