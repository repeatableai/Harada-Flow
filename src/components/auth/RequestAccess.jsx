import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Building2, Mail, Briefcase, Lock, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/api/apiClient';

export default function RequestAccess() {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await apiClient.auth.requestAccess({
        name: name.trim(),
        company: company.trim(),
        email: email.trim().toLowerCase(),
        jobTitle: jobTitle.trim(),
        password,
      });
      setShowSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    window.location.href = '/';
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">Request Submitted</h1>
              <p className="text-blue-200 mb-6">
                Upon verification, your credentials will be sent to you shortly. Thank you for your patience.
              </p>
              <Button
                onClick={handleBackToLogin}
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
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Request Temporary Access</h1>
            <p className="text-blue-200">
              Fill out the form below to request access
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-white flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" />
                Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20 h-11"
                required
                autoFocus
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company" className="text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                Company
              </Label>
              <Input
                id="company"
                type="text"
                placeholder="Your company name"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20 h-11"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20 h-11"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobTitle" className="text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-400" />
                Job Title
              </Label>
              <Input
                id="jobTitle"
                type="text"
                placeholder="Your job title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20 h-11"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Preferred Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20 h-11"
                required
                minLength={8}
                disabled={isLoading}
              />
            </div>

            <div className="pt-2 space-y-3">
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold"
                disabled={!name.trim() || !company.trim() || !email.trim() || !jobTitle.trim() || !password || password.length < 8 || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Request Access'
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleBackToLogin}
                className="w-full h-11 bg-white/5 border-white/20 text-white hover:bg-white/10 font-semibold"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Login
              </Button>
            </div>

            <p className="text-center text-blue-300 text-sm pt-2">
              Upon verification, your credentials will be sent to you shortly. Thank you for your patience.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
