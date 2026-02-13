import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: 'bg-gray-500' };

  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;

  if (score < 30) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score < 50) return { score, label: 'Fair', color: 'bg-orange-500' };
  if (score < 75) return { score, label: 'Good', color: 'bg-yellow-500' };
  return { score, label: 'Strong', color: 'bg-green-500' };
}

export default function SecurityTab() {
  const { logout } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const passwordStrength = getPasswordStrength(formData.newPassword);

  const validatePassword = () => {
    if (formData.newPassword.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/\d/.test(formData.newPassword)) {
      return 'Password must contain at least one number';
    }
    if (!/[a-zA-Z]/.test(formData.newPassword)) {
      return 'Password must contain at least one letter';
    }
    if (formData.newPassword !== formData.confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const handleChangePassword = async () => {
    setError('');

    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const confirmPasswordChange = async () => {
    setShowConfirmDialog(false);
    setIsChanging(true);
    setError('');

    try {
      await apiClient.auth.changePassword(formData.currentPassword, formData.newPassword);

      // Log out all other sessions after password change
      try {
        await apiClient.auth.logoutAllOtherSessions();
      } catch (err) {
        // Ignore errors from logging out other sessions
      }

      // Redirect to login
      await logout();
    } catch (err) {
      setError(err.message || 'Failed to change password');
      setIsChanging(false);
    }
  };

  const canSubmit =
    formData.currentPassword &&
    formData.newPassword &&
    formData.confirmPassword &&
    formData.newPassword === formData.confirmPassword &&
    formData.newPassword.length >= 8;

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-400" />
            Change Password
          </CardTitle>
          <CardDescription className="text-blue-300">
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Warning Banner */}
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-200 text-sm font-medium">Important</p>
              <p className="text-yellow-300/80 text-sm mt-1">
                Changing your password will log you out and require you to sign in again with your
                new password. All other active sessions will also be terminated.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Current Password */}
            <div className="space-y-2">
              <Label className="text-white">Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  placeholder="Enter your current password"
                  className="bg-white/10 border-white/20 text-white placeholder-blue-300/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label className="text-white">New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                  className="bg-white/10 border-white/20 text-white placeholder-blue-300/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {formData.newPassword && (
                <div className="space-y-1">
                  <Progress value={passwordStrength.score} className="h-2 bg-white/10" />
                  <p className={`text-xs ${passwordStrength.score >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                    Password strength: {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label className="text-white">Confirm New Password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  className="bg-white/10 border-white/20 text-white placeholder-blue-300/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                <p className="text-red-400 text-xs">Passwords do not match</p>
              )}
            </div>

            {/* Password Requirements */}
            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-blue-300 text-sm font-medium flex items-center gap-2 mb-2">
                <Info className="w-4 h-4" />
                Password Requirements
              </p>
              <ul className="text-blue-300/80 text-sm space-y-1 ml-6">
                <li className={formData.newPassword.length >= 8 ? 'text-green-400' : ''}>
                  {formData.newPassword.length >= 8 ? <Check className="w-3 h-3 inline mr-1" /> : '• '}
                  At least 8 characters
                </li>
                <li className={/[a-zA-Z]/.test(formData.newPassword) ? 'text-green-400' : ''}>
                  {/[a-zA-Z]/.test(formData.newPassword) ? <Check className="w-3 h-3 inline mr-1" /> : '• '}
                  At least one letter
                </li>
                <li className={/\d/.test(formData.newPassword) ? 'text-green-400' : ''}>
                  {/\d/.test(formData.newPassword) ? <Check className="w-3 h-3 inline mr-1" /> : '• '}
                  At least one number
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <Button
              onClick={handleChangePassword}
              disabled={isChanging || !canSubmit}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isChanging ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              Confirm Password Change
            </AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300">
              Are you sure you want to change your password? You will be logged out and need to sign
              in again with your new password. All other active sessions will be terminated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPasswordChange}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Yes, Change Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
