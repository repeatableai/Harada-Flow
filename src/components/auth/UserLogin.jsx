import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Key, Clock, AlertCircle } from 'lucide-react';

export default function UserLogin({ open, onClose, onLogin }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email'); // 'email' or 'code'
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Check if email has already been used
  const checkEmailUsed = (email) => {
    const usedEmails = JSON.parse(localStorage.getItem('mock_used_emails') || '[]');
    return usedEmails.includes(email.toLowerCase());
  };

  // Mark email as used
  const markEmailAsUsed = (email) => {
    const usedEmails = JSON.parse(localStorage.getItem('mock_used_emails') || '[]');
    if (!usedEmails.includes(email.toLowerCase())) {
      usedEmails.push(email.toLowerCase());
      localStorage.setItem('mock_used_emails', JSON.stringify(usedEmails));
    }
  };

  // Generate a 6-digit verification code
  const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Send verification code (mock)
  const sendVerificationCode = (email) => {
    const code = generateVerificationCode();
    setVerificationCode(code);
    console.log(`[Mock] Verification code sent to ${email}: ${code}`);
    
    // Store code with expiration (5 minutes)
    const codeData = {
      code,
      email: email.toLowerCase(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    };
    localStorage.setItem(`mock_verification_${email.toLowerCase()}`, JSON.stringify(codeData));
    
    // Start countdown
    setCountdown(300); // 5 minutes in seconds
  };

  // Countdown timer
  useEffect(() => {
    if (countdown > 0 && step === 'code') {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, step]);

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    setError('');

    const emailLower = email.toLowerCase().trim();
    
    if (!emailLower) {
      setError('Please enter your email address');
      return;
    }

    // Check if email has been used
    if (checkEmailUsed(emailLower)) {
      setError('This email has already been used. Each email can only be used once.');
      return;
    }

    // Send verification code
    sendVerificationCode(emailLower);
    setStep('code');
  };

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    setError('');

    const emailLower = email.toLowerCase().trim();
    const storedCodeData = localStorage.getItem(`mock_verification_${emailLower}`);
    
    if (!storedCodeData) {
      setError('Verification code expired. Please request a new one.');
      return;
    }

    const { code: storedCode, expiresAt } = JSON.parse(storedCodeData);
    
    if (Date.now() > expiresAt) {
      setError('Verification code expired. Please request a new one.');
      localStorage.removeItem(`mock_verification_${emailLower}`);
      return;
    }

    if (code.trim() !== storedCode) {
      setError('Invalid verification code');
      return;
    }

    // Code is valid - create user session
    const user = {
      id: `user-${Date.now()}`,
      email: emailLower,
      name: emailLower.split('@')[0], // Use email prefix as name
      job_title: 'User',
      role_id: null,
      userType: 'user',
      isPermanent: false,
      expiresAt: Date.now() + 72 * 60 * 60 * 1000, // 72 hours from now
    };

    // Mark email as used
    markEmailAsUsed(emailLower);
    
    // Clean up verification code
    localStorage.removeItem(`mock_verification_${emailLower}`);
    
    onLogin(user);
  };

  const handleResendCode = () => {
    setError('');
    setCode('');
    sendVerificationCode(email.toLowerCase().trim());
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
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
              disabled={!email.trim()}
            >
              Send Verification Code
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
                <strong>Code sent to:</strong> {email}
              </div>
              {countdown > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="w-3 h-3" />
                  <span>Code expires in: {formatTime(countdown)}</span>
                </div>
              )}
              {process.env.NODE_ENV === 'development' && verificationCode && (
                <div className="mt-2 p-2 bg-white/5 rounded text-center font-mono text-white">
                  <strong>Dev Code:</strong> {verificationCode}
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
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setError('');
                  setCountdown(0);
                }}
                className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
                disabled={code.length !== 6}
              >
                Verify & Sign In
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={handleResendCode}
              className="w-full text-blue-300 hover:text-blue-200 hover:bg-blue-500/10"
              disabled={countdown > 240} // Can resend after 1 minute
            >
              Resend Code
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

