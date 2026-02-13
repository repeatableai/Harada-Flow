import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/api/apiClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate emails match
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setError('Email addresses do not match. Please check and try again.');
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.auth.forgotPassword(email.trim().toLowerCase());
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Check Your Email</h1>
              <p className="text-blue-200 mb-6">
                If an account exists with <span className="text-white font-medium">{email}</span>, we've sent a password reset link.
              </p>
              <p className="text-blue-300 text-sm mb-6">
                The link will expire in 1 hour.
              </p>
              <Button
                onClick={() => window.location.href = '/'}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
            <p className="text-blue-200">
              Enter your email and we'll send you a link to reset your password.
            </p>
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
              <Label htmlFor="confirmEmail" className="text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Confirm Email
              </Label>
              <Input
                id="confirmEmail"
                type="email"
                placeholder="Confirm your email address"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20 h-12"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-3 pt-2">
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold"
                disabled={!email.trim() || !confirmEmail.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.href = '/'}
                className="w-full h-12 bg-white/5 border-white/20 text-white hover:bg-white/10 font-semibold"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Login
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
