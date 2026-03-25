// =============================================
// HYYRYN TRUST PROTOCOL — MORPHEUS
// Main JavaScript
// =============================================

// --- Theme Toggle ---
const toggleTheme = () => {
  const current = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', current === 'light' ? 'dark' : 'light');
  localStorage.setItem('theme', current === 'light' ? 'dark' : 'light');
};

const initTheme = () => {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.querySelector('.theme-toggle')?.addEventListener('click', toggleTheme);
};

// --- Navbar Scroll ---
const initNavbar = () => {
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.scrollY > 20);
  });
};

// --- Mobile Menu ---
const initMobileMenu = () => {
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  hamburger?.addEventListener('click', () => {
    mobileMenu?.classList.toggle('open');
    const spans = hamburger.querySelectorAll('span');
    mobileMenu?.classList.contains('open')
      ? (spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)',
         spans[1].style.opacity = '0',
         spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)')
      : (spans[0].style.transform = '', spans[1].style.opacity = '', spans[2].style.transform = '');
  });
};

// --- Scroll Animations ---
const initAnimations = () => {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: 0.12 }
  );
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
};

// --- Counter Animation ---
const animateCounter = (el) => {
  const target = parseFloat(el.dataset.target);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const duration = 1800;
  const start = performance.now();
  const update = (time) => {
    const progress = Math.min((time - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(ease * target * 10) / 10;
    el.textContent = prefix + (Number.isInteger(target) ? Math.floor(ease * target) : current.toFixed(1)) + suffix;
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

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();
  initMobileMenu();
  initAnimations();
  initCounters();
});
