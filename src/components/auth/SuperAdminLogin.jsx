import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Mail, Lock } from 'lucide-react';

export default function SuperAdminLogin({ open, onClose, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Super Admin credentials
  const SUPER_ADMIN_EMAIL = 'Kevin@repeatable.ai';
  const SUPER_ADMIN_PASSWORD = 'Merwan.1894';

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Case-insensitive email comparison
    if (email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && password === SUPER_ADMIN_PASSWORD) {
      const superAdminUser = {
        id: 'super-admin-1',
        email: SUPER_ADMIN_EMAIL,
        name: 'Kevin - Repeatable AI Admin',
        job_title: 'Super Administrator',
        role_id: 'super-admin',
        userType: 'superadmin',
        isPermanent: true,
      };
      onLogin(superAdminUser);
    } else {
      setError('Invalid email or password');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white/10 backdrop-blur-lg border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" />
            Super Admin Login
          </DialogTitle>
          <DialogDescription className="text-blue-200">
            Repeatable AI Administrator Access
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="admin-email" className="text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-purple-400" />
              Admin Email
            </Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="Enter admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password" className="text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-400" />
              Password
            </Label>
            <Input
              id="admin-password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20"
              required
            />
          </div>


          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
            disabled={!email.trim() || !password}
          >
            Sign In as Super Admin
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

