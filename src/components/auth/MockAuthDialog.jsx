import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, User } from 'lucide-react';

export default function MockAuthDialog({ open, onClose, onLogin }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState('email'); // Start directly with email step

  // Auto-focus email input when dialog opens
  useEffect(() => {
    if (open && step === 'email') {
      const emailInput = document.getElementById('email');
      if (emailInput) {
        setTimeout(() => emailInput.focus(), 100);
      }
    }
  }, [open, step]);

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (step === 'email') {
      if (email.trim()) {
        setStep('name');
      }
    }
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (step === 'name' && name.trim()) {
      const mockUser = {
        id: `mock-user-${Date.now()}`,
        email: email.trim() || 'developer@example.com',
        name: name.trim() || 'Local Developer',
        job_title: 'Software Developer',
        role_id: null,
      };
      onLogin(mockUser);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white/10 backdrop-blur-lg border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-400" />
            Sign In
          </DialogTitle>
          <DialogDescription className="text-blue-200">
            Enter your email and name to continue
          </DialogDescription>
        </DialogHeader>

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Email Address
              </Label>
              <Input
                id="email"
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
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
              disabled={!email.trim()}
            >
              Continue
            </Button>
            <p className="text-xs text-center text-blue-300 mt-4">
              Mock authentication for local development
            </p>
          </form>
        )}

        {step === 'name' && (
          <form onSubmit={handleNameSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                Your Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20"
                required
                autoFocus
              />
              <p className="text-xs text-blue-300 mt-1">
                Signed in as: <span className="text-blue-200">{email}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('email');
                  setName('');
                }}
                className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                disabled={!name.trim()}
              >
                Sign In
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

