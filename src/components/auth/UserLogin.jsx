import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Key, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/api/apiClient';

export default function UserLogin({ open, onClose, onLogin }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [displayCode, setDisplayCode] = useState(''); // Code to show in UI when email not configured
  const [step, setStep] = useState('email'); // 'email' or 'code'
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0 && step === 'code') {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, step]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const emailLower = email.toLowerCase().trim();

    if (!emailLower) {
      setError('Please enter your email address');
      setIsLoading(false);
      return;
    }

    try {
      const result = await apiClient.auth.emailVerify(emailLower);
      setCountdown(result.expiresIn || 300); // 5 minutes default
      if (result.displayInUI && result.code) {
        setDisplayCode(result.code);
      }
      setStep('code');
    } catch (err) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const emailLower = email.toLowerCase().trim();

    try {
      const result = await apiClient.auth.verifyCode(emailLower, code.trim());
      onLogin(result.user);
    } catch (err) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setCode('');
    setIsLoading(true);

    try {
      const result = await apiClient.auth.emailVerify(email.toLowerCase().trim());
      setCountdown(result.expiresIn || 300);
      if (result.displayInUI && result.code) {
        setDisplayCode(result.code);
      }
    } catch (err) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white/10 backdrop-blur-lg border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-400" />
            User Login
          </DialogTitle>
          <DialogDescription className="text-blue-200">
            One-time access with email verification
          </DialogDescription>
        </DialogHeader>

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4 mt-4">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-200">
              <strong>⚠️ Important:</strong> Each email can only be used once. Your session will expire in 72 hours.
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-email" className="text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Email Address
              </Label>
              <Input
                id="user-email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20"
                required
                autoFocus
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
              disabled={!email.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Verification Code'
              )}
            </Button>

            <p className="text-xs text-center text-blue-300">
              A 6-digit code will be sent to your email
            </p>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleCodeSubmit} className="space-y-4 mt-4">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="w-3 h-3" />
                <strong>Verification for:</strong> {email}
              </div>
              {countdown > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="w-3 h-3" />
                  <span>Code expires in: {formatTime(countdown)}</span>
                </div>
              )}
              {displayCode && (
                <div className="mt-3 p-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-white/10">
                  <p className="text-blue-200 text-xs mb-1 text-center">Your verification code:</p>
                  <p className="text-white text-2xl font-mono font-bold text-center tracking-widest">
                    {displayCode}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification-code" className="text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" />
                Verification Code
              </Label>
              <Input
                id="verification-code"
                type="text"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20 text-center text-2xl tracking-widest font-mono"
                maxLength={6}
                required
                autoFocus
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setDisplayCode('');
                  setError('');
                  setCountdown(0);
                }}
                className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
                disabled={code.length !== 6 || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Sign In'
                )}
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={handleResendCode}
              className="w-full text-blue-300 hover:text-blue-200 hover:bg-blue-500/10"
              disabled={countdown > 240 || isLoading}
            >
              Resend Code
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
