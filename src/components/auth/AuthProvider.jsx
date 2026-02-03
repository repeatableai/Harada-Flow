import React, { useState, useEffect, createContext, useContext } from 'react';
import { apiClient } from '@/api/apiClient';
import AuthTypeSelector from './AuthTypeSelector';
import SuperAdminLogin from './SuperAdminLogin';
import UserLogin from './UserLogin';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Auth context for app-wide access to user state
const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default function AuthProvider({ children }) {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authStep, setAuthStep] = useState('selector'); // 'selector', 'superadmin', 'user'
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = checking, true/false = known
  const [currentUser, setCurrentUser] = useState(null);

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
      setAuthStep('selector');
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
    setAuthStep('selector');
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

  const handleSelectType = (type) => {
    setAuthStep(type);
  };

  const handleClose = () => {
    // Don't allow closing if not authenticated
    if (!isAuthenticated) {
      return;
    }
    setShowAuthDialog(false);
    setAuthStep('selector');
  };

  const handleBackToSelector = () => {
    setAuthStep('selector');
  };

  // Context value
  const contextValue = {
    user: currentUser,
    isAuthenticated,
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
  };

  // Show auth dialog if not authenticated
  if (isAuthenticated === false) {
    return (
      <AuthContext.Provider value={contextValue}>
        <Dialog open={showAuthDialog} onOpenChange={handleClose}>
          <DialogContent className="sm:max-w-lg bg-transparent border-none shadow-none p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Select Company</DialogTitle>
              <DialogDescription>Choose which company to work with</DialogDescription>
            </DialogHeader>
            {authStep === 'selector' && (
              <div className="bg-white/10 backdrop-blur-lg border-white/20 rounded-lg p-6">
                <AuthTypeSelector onSelectType={handleSelectType} />
              </div>
            )}
            {authStep === 'superadmin' && (
              <SuperAdminLogin
                open={true}
                onClose={handleBackToSelector}
                onLogin={handleLogin}
              />
            )}
            {authStep === 'user' && (
              <UserLogin
                open={true}
                onClose={handleBackToSelector}
                onLogin={handleLogin}
              />
            )}
          </DialogContent>
        </Dialog>
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
