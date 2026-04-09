// =============================================
// HYYRYN — Auth Guard
// Include on all protected pages (dashboards, messages, etc.)
// Must be loaded AFTER api.js
// =============================================

(function() {
  // Require authentication
  if (!API.requireAuth()) return;

  const user = API.getUser();
  if (!user) {
    API.clearSession();
    window.location.href = '/login';
    return;
  }

  // Update navbar avatar / user name if elements exist
  const avatarEl = document.querySelector('.nav-avatar');
  if (avatarEl && user.name) {
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    avatarEl.textContent = initials;
  }

  // Wire up logout buttons
  document.querySelectorAll('[data-action="logout"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      API.logout();
    });
  });

  // Wire up notification badge
  async function updateNotificationBadge() {
    try {
      const data = await API.listNotifications();
      if (data && data.notifications) {
        const unread = data.notifications.filter(n => !n.read).length;
        const badges = document.querySelectorAll('.nav-badge');
        badges.forEach(badge => {
          if (badge.closest('.nav-icon-btn[href="/notifications"]') ||
              badge.closest('a[href="/notifications"]')) {
            badge.textContent = unread > 0 ? unread : '';
            badge.style.display = unread > 0 ? 'flex' : 'none';
          }
        });
      }
    } catch (e) {
      // Silently fail — notifications are not critical
    }
  }

  // Load notification count on page load
  updateNotificationBadge();

  // Expose user data globally for page-specific scripts
  window.HYYRYN_USER = user;
})();
