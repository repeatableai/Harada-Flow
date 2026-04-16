import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Mail,
  Briefcase,
  Building2,
  FolderTree,
  Calendar,
  Clock,
  Loader2,
  Save,
  Check,
  Zap,
} from 'lucide-react';

export default function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    jobTitle: '',
    dceDefaultMode: 'Working',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        jobTitle: user.jobTitle || '',
        dceDefaultMode: user.dceDefaultMode || 'Working',
      });
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.auth.updateMe({
        name: formData.name.trim() || undefined,
        jobTitle: formData.jobTitle.trim() || undefined,
        dceDefaultMode: formData.dceDefaultMode,
      });
      setSuccess('Profile updated successfully');
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    formData.name !== (user?.name || '') ||
    formData.jobTitle !== (user?.jobTitle || '') ||
    formData.dceDefaultMode !== (user?.dceDefaultMode || 'Working');

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Editable Profile Info */}
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Profile Information
          </CardTitle>
          <CardDescription className="text-blue-300">
            Update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 text-green-200 text-sm flex items-center gap-2">
              <Check className="w-4 h-4" />
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                Full Name
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your name"
                className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Email Address
              </Label>
              <Input
                value={user?.email || ''}
                disabled
                className="bg-white/5 border-white/10 text-blue-300 cursor-not-allowed"
              />
              <p className="text-blue-300/70 text-xs">
                Email cannot be changed. Contact support if needed.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-400" />
                Job Title
              </Label>
              <Input
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="e.g., Software Engineer, Product Manager"
                className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
              />
              <p className="text-blue-300/70 text-xs">
                This will pre-fill into deliverable creation forms
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-400" />
                DCE Default Mode
              </Label>
              <Select
                value={formData.dceDefaultMode}
                onValueChange={(value) => setFormData({ ...formData, dceDefaultMode: value })}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Working">Working Deliverable (fast)</SelectItem>
                  <SelectItem value="Executive">Executive DCE (comprehensive)</SelectItem>
                  <SelectItem value="AskEverySession">Ask Every Session</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-blue-300/70 text-xs">
                Controls how deliverables are generated — can be overridden per session
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Read-only Account Info */}
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" />
            Account Information
          </CardTitle>
          <CardDescription className="text-blue-300">
            Your account details and organization membership
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <Label className="text-blue-300 text-sm">Role</Label>
              <p className="text-white font-medium">
                {user?.role?.replace('_', ' ') || 'User'}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-blue-300 text-sm">Organization</Label>
              <p className="text-white font-medium flex items-center gap-2">
                {user?.organization ? (
                  <>
                    <Building2 className="w-4 h-4 text-purple-400" />
                    {user.organization.name}
                  </>
                ) : (
                  <span className="text-blue-300/70">No organization</span>
                )}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-blue-300 text-sm">Department</Label>
              <p className="text-white font-medium flex items-center gap-2">
                {user?.department ? (
                  <>
                    <FolderTree className="w-4 h-4 text-green-400" />
                    {user.department.name}
                  </>
                ) : (
                  <span className="text-blue-300/70">No department</span>
                )}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-blue-300 text-sm">Account Status</Label>
              <p className="text-white font-medium">
                {user?.isTrialUser ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-200 text-sm">
                    Trial User
                  </span>
                ) : user?.isPermanent ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-500/20 text-green-200 text-sm">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 text-sm">
                    Guest
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-blue-300 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Member Since
              </Label>
              <p className="text-white font-medium">{formatDate(user?.createdAt)}</p>
            </div>

            <div className="space-y-1">
              <Label className="text-blue-300 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Last Login
              </Label>
              <p className="text-white font-medium">{formatDateTime(user?.lastLoginAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
