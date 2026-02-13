import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/api/apiClient';

export default function UnifiedLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState('');

  const handleForgotPassword = () => {
    setIsNavigating(true);
    setNavigatingTo('forgot');
    window.location.href = '/forgot-password';
  };

  const handleRequestAccess = () => {
    setIsNavigating(true);
    setNavigatingTo('access');
    window.location.href = '/request-access';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await apiClient.auth.loginWithPassword(
        email.trim().toLowerCase(),
        password
      );
      onLogin(result.user);
    } catch (err) {
      // Check if user hasn't set password yet
      if (err.message?.includes('Invalid email or password')) {
        setError('Invalid email or password. If you are a new user, please check your email for an invite link.');
      } else {
        setError(err.message || 'Sign in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Sign In</h1>
        <p className="text-blue-200">Enter your credentials to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-400" />
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="your.email@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20 h-12"
            required
            autoFocus
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-400" />
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20 h-12"
            required
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold text-lg"
          disabled={!email.trim() || !password || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>

        <div className="text-center pt-2 space-y-2">
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isNavigating}
            className="text-blue-300 hover:text-blue-200 text-sm transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isNavigating && navigatingTo === 'forgot' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading...
              </>
            ) : (
              'Forgot your password?'
            )}
          </button>
          <div>
            <button
              type="button"
              onClick={handleRequestAccess}
              disabled={isNavigating}
              className="text-amber-300 hover:text-amber-200 text-sm transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isNavigating && navigatingTo === 'access' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading...
                </>
              ) : (
                'Request temporary access'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
