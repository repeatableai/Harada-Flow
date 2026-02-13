import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Globe,
  Users,
  Loader2,
  Save,
  Info,
} from 'lucide-react';

export default function OrganizationSettings() {
  const { organization, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    industry: '',
    companySize: '',
    website: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (organization?.id) {
      loadOrganization();
    }
  }, [organization?.id]);

  const loadOrganization = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.organizations.get(organization.id);
      setFormData({
        industry: data.industry || '',
        companySize: data.companySize || '',
        website: data.website || '',
      });
    } catch (error) {
      console.error('Failed to load organization:', error);
      setError('Failed to load organization settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiClient.organizations.update(organization.id, {
        industry: formData.industry || null,
        companySize: formData.companySize || null,
        website: formData.website || null,
      });
      setSuccess('Organization settings saved successfully');
      // Refresh user to get updated organization data
      if (refreshUser) {
        await refreshUser();
      }
    } catch (error) {
      setError(error.message || 'Failed to save organization settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!organization) {
    return (
      <Card className="bg-white/10 border-white/20">
        <CardContent className="p-8 text-center">
          <p className="text-blue-300">No organization assigned to your account.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-white/10 border-white/20">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-purple-400" />
          Company Settings
        </h3>
        <p className="text-blue-300 text-sm">
          Configure your company profile. This information will be pre-filled for employees when they create deliverables.
        </p>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-200 text-sm font-medium">Pre-fill Employee Forms</p>
          <p className="text-blue-300/80 text-sm mt-1">
            When you set these fields, they will automatically appear in the deliverable creation form for all employees in your company.
            Employees can still edit the values if needed.
          </p>
        </div>
      </div>

      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" />
            {organization.name}
          </CardTitle>
          <CardDescription className="text-blue-300">
            Update your company profile information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 text-green-200 text-sm">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                Industry
              </Label>
              <Input
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="e.g., Technology, Healthcare, Finance"
                className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
              />
              <p className="text-blue-300/70 text-xs">
                The industry your company operates in
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Company Size
              </Label>
              <Select
                value={formData.companySize || '__none__'}
                onValueChange={(value) => setFormData({ ...formData, companySize: value === '__none__' ? '' : value })}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select company size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not specified</SelectItem>
                  <SelectItem value="startup">Startup (1-10 employees)</SelectItem>
                  <SelectItem value="small">Small (11-50 employees)</SelectItem>
                  <SelectItem value="medium">Medium (51-200 employees)</SelectItem>
                  <SelectItem value="large">Large (201-1000 employees)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (1000+ employees)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-blue-300/70 text-xs">
                Helps tailor deliverables to your company's scale
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                Company Website
              </Label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://yourcompany.com"
                className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
              />
              <p className="text-blue-300/70 text-xs">
                Your company's website URL (used for context in deliverable generation)
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
