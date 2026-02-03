// API Client for Role Deliverable Matrices
// Replaces Base44 SDK with direct PostgreSQL backend calls

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  constructor() {
    this.accessToken = null;
    this.refreshPromise = null;
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  clearAccessToken() {
    this.accessToken = null;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // For httpOnly refresh token cookie
      });

      // Handle 401 - attempt token refresh
      if (response.status === 401 && !options._isRetry) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.request(endpoint, { ...options, _isRetry: true });
        }
        // Dispatch auth required event for app to handle
        window.dispatchEvent(new CustomEvent('auth-required'));
        throw new Error('Not authenticated');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        const err = new Error(error.error || error.message || 'Request failed');
        err.status = response.status;
        throw err;
      }

      // Handle empty responses
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      if (error.message === 'Not authenticated') {
        throw error;
      }
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  async refreshToken() {
    // Prevent multiple concurrent refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          this.accessToken = data.accessToken;
          return true;
        }
        return false;
      } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // Auth methods - compatible with Base44 interface
  auth = {
    me: async () => {
      return this.request('/auth/me');
    },

    updateMe: async (data) => {
      return this.request('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    login: async (nextUrl) => {
      // For compatibility - dispatch event to show login dialog
      window.dispatchEvent(new CustomEvent('auth-required', { detail: { nextUrl } }));
    },

    logout: async () => {
      try {
        await this.request('/auth/logout', { method: 'POST' });
      } catch (error) {
        // Ignore logout errors
      }
      this.clearAccessToken();
      // Reload to clear state
      window.location.href = window.location.origin;
    },

    isAuthenticated: async () => {
      try {
        await this.request('/auth/me');
        return true;
      } catch {
        return false;
      }
    },

    // Additional auth methods for login components
    emailVerify: async (email) => {
      return this.request('/auth/email-verify', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    verifyCode: async (email, code) => {
      const result = await this.request('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      this.accessToken = result.accessToken;
      return result;
    },

    loginWithPassword: async (email, password) => {
      const result = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      this.accessToken = result.accessToken;
      return result;
    },
  };

  // Entity methods - compatible with Base44 interface
  entities = {
    Company: {
      list: async () => {
        const result = await this.request('/companies');
        return result.data || result;
      },

      filter: async (query = {}, sort = '-created_date', limit = 50) => {
        const params = new URLSearchParams();
        if (query.created_by) params.set('created_by', query.created_by);
        if (sort) params.set('sort', sort);
        if (limit) params.set('limit', limit.toString());

        const result = await this.request(`/companies?${params.toString()}`);
        return Array.isArray(result) ? result : (result.data || []);
      },

      get: async (id) => {
        return this.request(`/companies/${id}`);
      },

      create: async (data) => {
        return this.request('/companies', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },

      update: async (id, data) => {
        return this.request(`/companies/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      },

      delete: async (id) => {
        return this.request(`/companies/${id}`, {
          method: 'DELETE',
        });
      },
    },

    Role: {
      // Simplified - roles are now embedded in User model
      list: async () => [],
      get: async (id) => ({
        id,
        permissions: ['can_start_new_role'],
      }),
    },

    SavedPrompt: {
      list: async () => {
        const result = await this.request('/prompts');
        return Array.isArray(result) ? result : (result.data || []);
      },

      create: async (companyId, data) => {
        return this.request(`/companies/${companyId}/prompts`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },

      delete: async (promptId) => {
        return this.request(`/prompts/${promptId}`, {
          method: 'DELETE',
        });
      },
    },
  };

  // Admin methods
  admin = {
    getUsers: async (params = {}) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, value.toString());
        }
      });
      return this.request(`/admin/users?${searchParams.toString()}`);
    },

    getUser: async (id) => {
      return this.request(`/admin/users/${id}`);
    },

    getCompanies: async (params = {}) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, value.toString());
        }
      });
      return this.request(`/admin/companies?${searchParams.toString()}`);
    },

    getCompany: async (id) => {
      return this.request(`/admin/companies/${id}`);
    },

    getStats: async () => {
      return this.request('/admin/stats');
    },

    // Time Study methods
    getTimeStudies: async (params = {}) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, value.toString());
        }
      });
      return this.request(`/admin/time-studies?${searchParams.toString()}`);
    },

    getTimeStudyStats: async (params = {}) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, value.toString());
        }
      });
      return this.request(`/admin/time-studies/stats?${searchParams.toString()}`);
    },
  };

  // Integrations - kept for compatibility but will need separate implementation
  integrations = {
    Core: {
      InvokeLLM: async (params) => {
        // TODO: Implement LLM integration endpoint
        // For now, this will need to be handled by the backend
        return this.request('/integrations/llm', {
          method: 'POST',
          body: JSON.stringify(params),
        });
      },
      SendEmail: async (params) => {
        return this.request('/integrations/email', {
          method: 'POST',
          body: JSON.stringify(params),
        });
      },
    },
  };
}

export const apiClient = new ApiClient();

// Default export for compatibility
export default apiClient;
