import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AuthTypeSelector from './AuthTypeSelector';
import SuperAdminLogin from './SuperAdminLogin';
import UserLogin from './UserLogin';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function MockAuthProvider({ children }) {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authStep, setAuthStep] = useState('selector'); // 'selector', 'superadmin', 'user'
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = checking, true/false = known

  useEffect(() => {
    // Check if we're in mock mode
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const useMockMode = isLocalhost && (
      new URLSearchParams(window.location.search).get('mock') === 'true' ||
      localStorage.getItem('base44_mock_mode') === 'true'
    );

    if (!useMockMode) {
      setIsAuthenticated(true); // Not in mock mode, assume real auth handles it
      return;
    }

    // Check authentication status and expiration
    const checkAuth = async () => {
      try {
        const stored = localStorage.getItem('mock_base44_user');
        if (!stored) {
          setIsAuthenticated(false);
          setShowAuthDialog(true);
          return;
        }

        const user = JSON.parse(stored);
        
        // Check if user session has expired (for non-permanent users)
        if (!user.isPermanent && user.expiresAt) {
          if (Date.now() > user.expiresAt) {
            // Session expired
            localStorage.removeItem('mock_base44_user');
            setIsAuthenticated(false);
            setShowAuthDialog(true);
            return;
          }
        }

        const auth = await base44.auth.isAuthenticated();
        setIsAuthenticated(auth);
        if (!auth) {
          setShowAuthDialog(true);
        }
      } catch (error) {
        setIsAuthenticated(false);
        setShowAuthDialog(true);
      }
    };

    checkAuth();

    // Listen for auth required events
    const handleAuthRequired = () => {
      setShowAuthDialog(true);
      setAuthStep('selector');
    };

    window.addEventListener('mock-auth-required', handleAuthRequired);

    return () => {
      window.removeEventListener('mock-auth-required', handleAuthRequired);
    };
  }, []);

  const handleLogin = (user) => {
    // Store user in localStorage
    localStorage.setItem('mock_base44_user', JSON.stringify(user));
    setIsAuthenticated(true);
    setShowAuthDialog(false);
    setAuthStep('selector');
    // Reload to refresh auth state
    window.location.reload();
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

  // Show auth dialog if not authenticated in mock mode
  if (isAuthenticated === false) {
    return (
      <>
        {children}
        <Dialog open={showAuthDialog} onOpenChange={handleClose}>
          <DialogContent className="sm:max-w-lg bg-transparent border-none shadow-none p-0">
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
      </>
    );
  }

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="text-white">Checking authentication...</div>
      </div>
    );
  }

  // Authenticated, show app
  return <>{children}</>;
}

