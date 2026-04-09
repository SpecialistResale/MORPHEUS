// =============================================
// HYYRYN — API Client
// Shared across all pages
// =============================================

const API = {
  BASE: '/api',

  // Get stored session token
  getToken() {
    return localStorage.getItem('hyyryn_token');
  },

  // Get stored user
  getUser() {
    const raw = localStorage.getItem('hyyryn_user');
    return raw ? JSON.parse(raw) : null;
  },

  // Save session
  saveSession(token, user) {
    localStorage.setItem('hyyryn_token', token);
    localStorage.setItem('hyyryn_user', JSON.stringify(user));
  },

  // Clear session
  clearSession() {
    localStorage.removeItem('hyyryn_token');
    localStorage.removeItem('hyyryn_user');
  },

  // Check if logged in
  isLoggedIn() {
    return !!this.getToken();
  },

  // Redirect to login if not authenticated
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/login';
      return false;
    }
    return true;
  },

  // Redirect to dashboard if already logged in
  redirectIfLoggedIn() {
    if (this.isLoggedIn()) {
      const user = this.getUser();
      window.location.href = user?.role === 'pro' ? '/dashboard' : '/buyer-dashboard';
    }
  },

  // Make authenticated API request
  async request(path, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${this.BASE}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.clearSession();
      window.location.href = '/login';
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong');
    }

    return data;
  },

  // ── Auth ──
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data) {
      this.saveSession(data.token, data.user);
    }
    return data;
  },

  async register(fields) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(fields),
    });
    if (data) {
      this.saveSession(data.token, data.user);
    }
    return data;
  },

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore errors on logout
    }
    this.clearSession();
    window.location.href = '/login';
  },

  async getMe() {
    return this.request('/auth/me');
  },

  // ── Jobs ──
  async listJobs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/jobs${qs ? '?' + qs : ''}`);
  },

  async getJob(id) {
    return this.request(`/jobs/${id}`);
  },

  async createJob(fields) {
    return this.request('/jobs', {
      method: 'POST',
      body: JSON.stringify(fields),
    });
  },

  async updateJob(id, fields) {
    return this.request(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
  },

  // ── Quotes ──
  async listQuotes(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/quotes${qs ? '?' + qs : ''}`);
  },

  async submitQuote(fields) {
    return this.request('/quotes', {
      method: 'POST',
      body: JSON.stringify(fields),
    });
  },

  // ── Messages ──
  async listConversations() {
    return this.request('/messages');
  },

  async getMessages(otherUserId) {
    return this.request(`/messages?with=${otherUserId}`);
  },

  async sendMessage(recipientId, body, jobId = null) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: recipientId, body, job_id: jobId }),
    });
  },

  // ── Notifications ──
  async listNotifications() {
    return this.request('/notifications');
  },

  async markNotificationsRead() {
    return this.request('/notifications', { method: 'PUT' });
  },

  // ── Dashboard ──
  async getDashboardStats() {
    return this.request('/dashboard/stats');
  },

  // ── Escrow ──
  async getEscrow(jobId) {
    return this.request(`/escrow?job_id=${jobId}`);
  },

  async fundEscrow(jobId, amountPence, milestoneLabel = null) {
    return this.request('/escrow', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, amount_pence: amountPence, milestone_label: milestoneLabel }),
    });
  },

  async releaseEscrow(escrowId) {
    return this.request('/escrow/release', {
      method: 'POST',
      body: JSON.stringify({ escrow_id: escrowId }),
    });
  },

  // ── Utility ──
  formatPence(pence) {
    return '£' + (pence / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB');
  },
};
