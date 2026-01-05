/**
 * Mock Base44 client for local development without Base44 authentication
 * Use this when running on localhost and Base44 authentication isn't configured
 */

// Mock user data
const mockUser = {
  id: 'mock-user-1',
  email: 'developer@example.com',
  name: 'Local Developer',
  job_title: 'Software Developer',
  role_id: null,
};

// Helper to get current mock user
const getCurrentMockUser = () => {
  const stored = localStorage.getItem('mock_base44_user');
  return stored ? JSON.parse(stored) : mockUser;
};

// Mock storage for companies (persisted in localStorage)
const getMockCompanies = () => {
  const stored = localStorage.getItem('mock_base44_companies');
  return stored ? JSON.parse(stored) : [];
};

const saveMockCompanies = (companies) => {
  localStorage.setItem('mock_base44_companies', JSON.stringify(companies));
};

// Mock entities
const mockEntities = {
  Company: {
    list: async () => {
      return getMockCompanies();
    },
    filter: async (query, sort, limit) => {
      let companies = getMockCompanies();
      
      // Apply filters
      if (query) {
        Object.keys(query).forEach(key => {
          companies = companies.filter(company => company[key] === query[key]);
        });
      }
      
      // Apply sorting
      if (sort) {
        const [field, direction] = sort.startsWith('-') 
          ? [sort.substring(1), 'desc'] 
          : [sort, 'asc'];
        companies.sort((a, b) => {
          const aVal = a[field];
          const bVal = b[field];
          if (direction === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
          }
        });
      }
      
      // Apply limit
      if (limit) {
        companies = companies.slice(0, limit);
      }
      
      return companies;
    },
    get: async (id) => {
      const companies = getMockCompanies();
      return companies.find(c => c.id === id) || null;
    },
    create: async (data) => {
      const user = getCurrentMockUser();
      const newCompany = {
        id: `company-${Date.now()}`,
        ...data,
        created_date: new Date().toISOString(),
        created_by: user.email,
        productivity_matrix: null,
        performance_matrix: null,
      };
      const companies = getMockCompanies();
      companies.push(newCompany);
      saveMockCompanies(companies);
      return newCompany;
    },
    update: async (id, data) => {
      const companies = getMockCompanies();
      const index = companies.findIndex(c => c.id === id);
      if (index !== -1) {
        companies[index] = { ...companies[index], ...data };
        saveMockCompanies(companies);
        return companies[index];
      }
      return null;
    },
    delete: async (id) => {
      const companies = getMockCompanies();
      const filtered = companies.filter(c => c.id !== id);
      saveMockCompanies(filtered);
    },
  },
  Role: {
    list: async () => [],
    filter: async (query, sort, limit) => {
      return [];
    },
    get: async (id) => ({
      id,
      name: 'Developer',
      permissions: ['can_start_new_role'],
    }),
  },
};

// Mock integrations
const mockIntegrations = {
  Core: {
    InvokeLLM: async ({ prompt, response_json_schema }) => {
      // Return mock structured data based on schema
      console.log('Mock InvokeLLM called with prompt:', prompt.substring(0, 100) + '...');
      
      if (response_json_schema?.properties?.columns) {
        // Mock matrix data
        return {
          title: 'Mock Matrix',
          columns: Array.from({ length: 8 }, (_, i) => ({
            name: `Area ${i + 1}`,
            deliverables: Array.from({ length: 8 }, (_, j) => `Deliverable ${i + 1}-${j + 1}`),
            problems: Array.from({ length: 8 }, (_, j) => ({
              problem: `Problem ${i + 1}-${j + 1}`,
              expert: 'Expert Name',
              strategy: 'Strategy description',
            })),
          })),
        };
      }
      
      return {
        deliverable_name: 'Mock Deliverable',
        overview: 'This is mock data for local development',
        prompts: [
          {
            step: 1,
            title: 'Step 1',
            description: 'Mock step description',
            prompt: 'This is a mock prompt for local development',
          },
        ],
      };
    },
    SendEmail: async () => ({ success: true }),
    UploadFile: async () => ({ url: 'mock-url' }),
    GenerateImage: async () => ({ url: 'mock-image-url' }),
    ExtractDataFromUploadedFile: async () => ({}),
    CreateFileSignedUrl: async () => ({ url: 'mock-signed-url' }),
    UploadPrivateFile: async () => ({ url: 'mock-private-url' }),
  },
};

// Mock auth with localStorage persistence and expiration checking
const getMockUser = () => {
  const stored = localStorage.getItem('mock_base44_user');
  if (!stored) return null;
  
  const user = JSON.parse(stored);
  
  // Check expiration for non-permanent users
  if (!user.isPermanent && user.expiresAt) {
    if (Date.now() > user.expiresAt) {
      // Session expired
      localStorage.removeItem('mock_base44_user');
      return null;
    }
  }
  
  return user;
};

const setMockUser = (user) => {
  if (user) {
    localStorage.setItem('mock_base44_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('mock_base44_user');
  }
};

const mockAuth = {
  me: async () => {
    const user = getMockUser();
    if (!user) {
      // Trigger login flow
      const event = new CustomEvent('mock-auth-required');
      window.dispatchEvent(event);
      throw new Error('Not authenticated');
    }
    
    // Check expiration again
    if (!user.isPermanent && user.expiresAt && Date.now() > user.expiresAt) {
      setMockUser(null);
      const event = new CustomEvent('mock-auth-required');
      window.dispatchEvent(event);
      throw new Error('Session expired');
    }
    
    return user;
  },
  updateMe: async (data) => {
    const user = getMockUser();
    if (!user) {
      throw new Error('Not authenticated');
    }
    const updated = { ...user, ...data };
    setMockUser(updated);
    return updated;
  },
  login: (nextUrl) => {
    // Trigger login dialog
    const event = new CustomEvent('mock-auth-required', { detail: { nextUrl } });
    window.dispatchEvent(event);
  },
  logout: async () => {
    setMockUser(null);
    // Reload to show login
    window.location.href = window.location.pathname + '?mock=true';
  },
  setToken: (token) => {
    // In mock mode, we store user instead of token
    if (token) {
      const user = getMockUser() || mockUser;
      setMockUser(user);
    }
  },
  isAuthenticated: async () => {
    const user = getMockUser();
    if (!user) return false;
    
    // Check expiration
    if (!user.isPermanent && user.expiresAt && Date.now() > user.expiresAt) {
      setMockUser(null);
      return false;
    }
    
    return true;
  },
};

export const mockBase44 = {
  entities: mockEntities,
  integrations: mockIntegrations,
  auth: mockAuth,
  setToken: () => {},
  getConfig: () => ({
    serverUrl: 'mock://localhost',
    appId: 'mock-app-id',
    env: 'dev',
    requiresAuth: false,
  }),
};

