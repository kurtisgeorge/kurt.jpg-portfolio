// app.js
// Simple, fast gallery + lightbox fed by a generated manifest at ./assets/images.json

const galleryEl = document.querySelector("#gallery");

const lb = document.querySelector("#lightbox");
const lbImg = document.querySelector("#lb-image");
const lbCaption = document.querySelector("#lb-caption");

const btnClose = document.querySelector("#btn-close");
const btnPrev = document.querySelector("#btn-prev");
const btnNext = document.querySelector("#btn-next");

let items = [];
let currentIndex = -1;
let lastFocusedEl = null;

async function loadImages() {
  const res = await fetch("./assets/images.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load images.json (${res.status})`);

  const data = await res.json();
  // Allow either an array or { items: [...] }
  items = Array.isArray(data) ? data : (data.items || []);

  renderGallery(items);
}

function renderGallery(list) {
  galleryEl.textContent = "";

  const frag = document.createDocumentFragment();

  list.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tile";
    button.setAttribute("aria-label", item.alt || item.caption || "Open image");
    button.dataset.index = String(index);

    const img = document.createElement("img");

    // Grid should use smaller assets:
    img.src = item.src.thumb;
    if (item.src.srcset) img.srcset = item.src.srcset;
    img.sizes = "(max-width: 520px) 50vw, (max-width: 1100px) 33vw, 25vw";

    img.alt = item.alt || "";
    img.loading = "lazy";
    img.decoding = "async";

    // Optional: if the manifest includes dimensions, prevent CLS.
    if (item.w && item.h) {
      img.width = item.w;
      img.height = item.h;
    }

    button.appendChild(img);

    button.addEventListener("click", () => openLightbox(index, button));
    frag.appendChild(button);
  });

  galleryEl.appendChild(frag);
}

function openLightbox(index, triggerEl) {
  if (!items.length) return;

  lastFocusedEl = triggerEl || document.activeElement;
  currentIndex = clampIndex(index);

  updateLightbox();

  lb.classList.add("open");
  lb.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");

  // Put focus on close for keyboard users.
  btnClose.focus();
}

function closeLightbox() {
  lb.classList.remove("open");
  lb.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");

  currentIndex = -1;

  // Return focus to the tile that opened it.
  if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
    lastFocusedEl.focus();
  }
  lastFocusedEl = null;
}

function updateLightbox() {
  const item = items[currentIndex];
  if (!item) return;

  // Use the large/optimized file for the lightbox (not the original)
  lbImg.src = item.src.full;
  lbImg.alt = item.alt || "";
  lbCaption.textContent = item.caption || "";

  // Preload neighbors for instant next/prev
  preloadIndex(currentIndex + 1);
  preloadIndex(currentIndex - 1);
}

function preloadIndex(i) {
  const idx = clampIndex(i);
  const item = items[idx];
  if (!item) return;

  const img = new Image();
  img.decoding = "async";
  img.src = item.src.full;
}

function clampIndex(i) {
  const n = items.length;
  if (!n) return 0;
  return ((i % n) + n) % n;
}

function next() {
  currentIndex = clampIndex(currentIndex + 1);
  updateLightbox();
}

function prev() {
  currentIndex = clampIndex(currentIndex - 1);
  updateLightbox();
}

// Buttons
btnNext.addEventListener("click", next);
btnPrev.addEventListener("click", prev);
btnClose.addEventListener("click", closeLightbox);

// Keyboard
window.addEventListener("keydown", (e) => {
  if (!lb.classList.contains("open")) return;

  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowRight") next();
  if (e.key === "ArrowLeft") prev();

  // Basic focus trap (keeps tabbing inside the three buttons)
  if (e.key === "Tab") {
    const focusables = [btnClose, btnPrev, btnNext];
    const active = document.activeElement;
    const idx = focusables.indexOf(active);

    if (e.shiftKey) {
      if (idx <= 0) {
        e.preventDefault();
        focusables[focusables.length - 1].focus();
      }
    } else {
      if (idx === focusables.length - 1) {
        e.preventDefault();
        focusables[0].focus();
      }
    }
  }
});

// Click outside image to close
lb.addEventListener("click", (e) => {
  if (e.target === lb) closeLightbox();
});

// Simple swipe for touch
let touchStartX = 0;
let touchStartY = 0;

lb.addEventListener("touchstart", (e) => {
  if (!lb.classList.contains("open")) return;
  const t = e.changedTouches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });

lb.addEventListener("touchend", (e) => {
  if (!lb.classList.contains("open")) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  // Only treat mostly-horizontal swipes as navigation.
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

  if (dx < 0) next();
  else prev();
}, { passive: true });

loadImages().catch((err) => {
  console.error(err);
  const p = document.createElement("p");
  p.style.padding = "20px";
  p.style.color = "rgba(244,244,245,.8)";
  p.textContent = "Could not load images. Make sure assets/images.json exists and is valid JSON.";
  galleryEl.appendChild(p);
});