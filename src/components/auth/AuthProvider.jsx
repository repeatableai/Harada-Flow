import React, { useState, useEffect, createContext, useContext } from 'react';
import { apiClient } from '@/api/apiClient';
import UnifiedLogin from './UnifiedLogin';

// Auth context for app-wide access to user state
const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Public routes that don't require authentication
const PUBLIC_AUTH_ROUTES = ['/forgot-password', '/reset-password', '/set-password', '/request-access'];

function isPublicAuthRoute() {
  return PUBLIC_AUTH_ROUTES.includes(window.location.pathname);
}

export default function AuthProvider({ children }) {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = checking, true/false = known
  const [currentUser, setCurrentUser] = useState(null);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  useEffect(() => {
    // Try to restore session on mount
    const checkAuth = async () => {
      try {
        // Try to refresh token first (from httpOnly cookie)
        const refreshed = await apiClient.refreshToken();

        if (refreshed) {
          // Token refreshed, get user info
          const user = await apiClient.auth.me();
          setCurrentUser(user);
          setIsAuthenticated(true);
        } else {
          // No valid session
          setIsAuthenticated(false);
          setShowAuthDialog(true);
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        setIsAuthenticated(false);
        setShowAuthDialog(true);
      }
    };

    checkAuth();

    // Listen for auth required events
    const handleAuthRequired = (event) => {
      setShowAuthDialog(true);
    };

    window.addEventListener('auth-required', handleAuthRequired);

    return () => {
      window.removeEventListener('auth-required', handleAuthRequired);
    };
  }, []);

  const handleLogin = async (user) => {
    // User object comes from login components with accessToken already set
    setCurrentUser(user);
    setIsAuthenticated(true);
    setShowAuthDialog(false);
    setJustLoggedIn(true);
  };

  const clearJustLoggedIn = () => {
    setJustLoggedIn(false);
  };

  const handleLogout = async () => {
    try {
      await apiClient.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
    apiClient.clearAccessToken();
    window.location.href = window.location.origin;
  };

  // Role hierarchy levels for comparison
  const ROLE_LEVELS = {
    USER: 1,
    DEPARTMENT_ADMIN: 2,
    COMPANY_ADMIN: 3,
    ADMIN: 3, // Maps to COMPANY_ADMIN level
    SUPER_ADMIN: 4,
  };

  // Check if current user can manage a target role
  const canManage = (targetRole) => {
    if (!currentUser) return false;
    const userLevel = ROLE_LEVELS[currentUser.role] || 0;
    const targetLevel = ROLE_LEVELS[targetRole] || 0;
    return userLevel > targetLevel;
  };

  // Check if current user has at least the specified role level
  const hasRole = (requiredRole) => {
    if (!currentUser) return false;
    const userLevel = ROLE_LEVELS[currentUser.role] || 0;
    const requiredLevel = ROLE_LEVELS[requiredRole] || 0;
    return userLevel >= requiredLevel;
  };

  // Check if user is in a specific organization
  const isInOrg = (orgId) => {
    if (!currentUser) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true; // Super admins have access to all orgs
    return currentUser.organizationId === orgId;
  };

  // Check if user is in a specific department
  const isInDept = (deptId) => {
    if (!currentUser) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (['COMPANY_ADMIN', 'ADMIN'].includes(currentUser.role)) return true; // Company admins can access all depts in their org
    return currentUser.departmentId === deptId;
  };

  // Check if user is any kind of admin
  const isAdmin = () => {
    if (!currentUser) return false;
    return ['DEPARTMENT_ADMIN', 'COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(currentUser.role);
  };

  // Check if user is company admin or higher
  const isCompanyAdmin = () => {
    if (!currentUser) return false;
    return ['COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(currentUser.role);
  };

  // Check if user is super admin
  const isSuperAdmin = () => {
    if (!currentUser) return false;
    return currentUser.role === 'SUPER_ADMIN';
  };

  // Context value
  const contextValue = {
    user: currentUser,
    isAuthenticated,
    justLoggedIn,
    clearJustLoggedIn,
    logout: handleLogout,
    refreshUser: async () => {
      try {
        const user = await apiClient.auth.me();
        setCurrentUser(user);
        return user;
      } catch (error) {
        console.error('Failed to refresh user:', error);
        return null;
      }
    },
    // Role/permission helpers
    canManage,
    hasRole,
    isInOrg,
    isInDept,
    isAdmin,
    isCompanyAdmin,
    isSuperAdmin,
    // Organization/Department info
    organization: currentUser?.organization || null,
    department: currentUser?.department || null,
  };

  // Allow public auth routes (forgot password, reset password, set password) without authentication
  if (isPublicAuthRoute()) {
    return (
      <AuthContext.Provider value={contextValue}>
        {children}
      </AuthContext.Provider>
    );
  }

  // Show login if not authenticated
  if (isAuthenticated === false) {
    return (
      <AuthContext.Provider value={contextValue}>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
          <div className="w-full max-w-md">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8">
              <UnifiedLogin onLogin={handleLogin} />
            </div>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <AuthContext.Provider value={contextValue}>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <div className="text-white">Checking authentication...</div>
        </div>
      </AuthContext.Provider>
    );
  }

  // Authenticated, show app
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
