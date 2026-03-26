// =============================================
// HYYRYN — V4.38
// Main JavaScript
// =============================================

// --- Navbar Scroll ---
const initNavbar = () => {
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.scrollY > 20);
  });
};

// --- Mobile Menu ---
const closeMobileMenu = (hamburger, mobileMenu) => {
  if (!mobileMenu || !hamburger) return;
  mobileMenu.classList.remove('open');
  const spans = hamburger.querySelectorAll('span');
  spans[0].style.transform = '';
  spans[1].style.opacity = '';
  spans[2].style.transform = '';
};

const initMobileMenu = () => {
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    mobileMenu.classList.toggle('open');
    const spans = hamburger.querySelectorAll('span');
    if (mobileMenu.classList.contains('open')) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      closeMobileMenu(hamburger, mobileMenu);
    }
  });

  // Close on nav link click
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => closeMobileMenu(hamburger, mobileMenu));
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
      closeMobileMenu(hamburger, mobileMenu);
    }
  });

  // Close on resize to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMobileMenu(hamburger, mobileMenu);
    }
  });
};

// --- Hero Search ---
const initSearch = () => {
  const searchInput = document.querySelector('.hero-search input');
  const searchBtn = document.querySelector('.btn-search');
  if (!searchInput || !searchBtn) return;

  searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    window.location.href = query ? `/search?q=${encodeURIComponent(query)}` : '/search';
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchBtn.click();
  });
};

// --- Scroll Animations ---
const initAnimations = () => {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: 0.1 }
  );
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
};

// --- Counter Animation ---
const animateCounter = (el) => {
  const target = parseFloat(el.dataset.target);
  const suffix = el.dataset.suffix || '';
  const prefix = el.dataset.prefix || '';
  const duration = 1800;
  const start = performance.now();
  const isInteger = Number.isInteger(target);
  const update = (time) => {
    const progress = Math.min((time - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = ease * target;
    const display = isInteger ? Math.floor(current).toString() : current.toFixed(1);
    el.textContent = prefix + display + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
};

const initCounters = () => {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => {
      if (e.isIntersecting && !e.target.dataset.animated) {
        e.target.dataset.animated = 'true';
        animateCounter(e.target);
      }
    }),
    { threshold: 0.5 }
  );
  document.querySelectorAll('[data-target]').forEach(el => observer.observe(el));
};

// --- Category cards → search, Listing cards → service ---
const initCards = () => {
  document.querySelectorAll('.cat-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => { window.location.href = '/search'; });
  });
  document.querySelectorAll('.listing-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => { window.location.href = '/service'; });
  });
};

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMobileMenu();
  initSearch();
  initAnimations();
  initCounters();
  initCards();
});
