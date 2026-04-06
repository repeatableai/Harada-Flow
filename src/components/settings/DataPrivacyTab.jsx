import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Database,
  Trash2,
  AlertTriangle,
  Loader2,
  FileText,
  Briefcase,
  Clock,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';

export default function DataPrivacyTab() {
  const { user, logout } = useAuth();
  const [dataSummary, setDataSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Deletion flow state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showFinalDialog, setShowFinalDialog] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const requiredPhrase = 'DELETE ALL MY DATA';
  const hasPassword = dataSummary?.user?.hasPassword;

  useEffect(() => {
    loadDataSummary();
  }, []);

  async function loadDataSummary() {
    setIsLoading(true);
    setError('');
    try {
      const summary = await apiClient.auth.getDataSummary();
      setDataSummary(summary);
    } catch (err) {
      setError(err.message || 'Failed to load data summary');
    } finally {
      setIsLoading(false);
    }
  }

  function handleDeleteRequest() {
    setDeleteError('');
    setConfirmationPhrase('');
    setPassword('');
    setShowConfirmDialog(true);
  }

  function handleFirstConfirm() {
    setShowConfirmDialog(false);
    setShowFinalDialog(true);
  }

  async function handleFinalDelete() {
    if (confirmationPhrase !== requiredPhrase) {
      setDeleteError(`Please type exactly: ${requiredPhrase}`);
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      await apiClient.auth.eraseAccount(confirmationPhrase, password || undefined);
      // Account is deleted - redirect to login
      await logout();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  }

  function handleCancelFinal() {
    setShowFinalDialog(false);
    setConfirmationPhrase('');
    setPassword('');
    setDeleteError('');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-blue-300">Loading your data summary...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-white/10 border-white/20">
        <CardContent className="py-8 text-center">
          <p className="text-red-400">{error}</p>
          <Button onClick={loadDataSummary} className="mt-4 bg-blue-600 hover:bg-blue-700">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const counts = dataSummary?.dataCounts || {};

  return (
    <div className="space-y-6">
      {/* GDPR Info Card */}
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-400" />
            Your Data Rights (GDPR)
          </CardTitle>
          <CardDescription className="text-blue-300">
            Under GDPR Article 17, you have the right to request erasure of your personal data.
            Below is a summary of all data stored in your account.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Data Summary */}
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            Your Stored Data
          </CardTitle>
          <CardDescription className="text-blue-300">
            This is everything we store that is linked to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DataItem
              icon={<Briefcase className="w-4 h-4" />}
              label="Role Sessions"
              count={counts.roleSessions}
              description="Your saved role configurations"
            />
            <DataItem
              icon={<FileText className="w-4 h-4" />}
              label="Saved Deliverables"
              count={counts.savedDeliverables}
              description="Generated deliverable outputs"
            />
            <DataItem
              icon={<FileText className="w-4 h-4" />}
              label="Knowledge Files"
              count={counts.knowledgeFiles}
              description="Uploaded documents"
            />
            <DataItem
              icon={<Clock className="w-4 h-4" />}
              label="Time Studies"
              count={counts.timeStudies}
              description="Productivity measurements"
            />
          </div>

          {/* Retained data notice */}
          {dataSummary?.retainedForCompliance?.activityLogs > 0 && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-blue-200 text-sm">
                <strong>Compliance note:</strong> {dataSummary.retainedForCompliance.activityLogs} activity
                log entries will be anonymized but retained as required by GDPR Article 17(3)(e) for
                legal compliance purposes. Your name and email will be removed from these records.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone - Account Deletion */}
      <Card className="bg-white/10 border-red-500/30">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Delete Account & Erase All Data
          </CardTitle>
          <CardDescription className="text-red-300/80">
            Permanently delete your account and erase all personal data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-2">
                <p className="text-red-200 font-medium">This will permanently erase:</p>
                <ul className="text-red-300/80 space-y-1 ml-4 list-disc">
                  <li>Your account and profile information</li>
                  <li>All role sessions and generated deliverables</li>
                  <li>All uploaded knowledge files</li>
                  <li>All time study records</li>
                  <li>All active login sessions</li>
                </ul>
                <p className="text-red-300/80 mt-2">
                  This action is <strong className="text-red-200">irreversible</strong>. You will not be
                  able to recover any of this data.
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleDeleteRequest}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Request Data Erasure
          </Button>
        </CardContent>
      </Card>

      {/* Step 1: Initial Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Are you sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300">
              You are about to permanently delete your account and erase all personal data.
              This action cannot be undone. You will lose access to all your role sessions,
              deliverables, and uploaded files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFirstConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, I want to delete my account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 2: Final Confirmation with Typed Phrase */}
      <AlertDialog open={showFinalDialog} onOpenChange={(open) => { if (!open) handleCancelFinal(); }}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Final Confirmation
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-blue-300 space-y-4">
                <p>
                  To confirm, type <strong className="text-white font-mono">{requiredPhrase}</strong> below.
                </p>

                <div className="space-y-2">
                  <Label className="text-white text-sm">Confirmation Phrase</Label>
                  <Input
                    value={confirmationPhrase}
                    onChange={(e) => setConfirmationPhrase(e.target.value)}
                    placeholder={`Type: ${requiredPhrase}`}
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50 font-mono"
                    autoComplete="off"
                  />
                </div>

                {/* Password field - only shown if user has a password */}
                {hasPassword && (
                  <div className="space-y-2">
                    <Label className="text-white text-sm">Enter your password to confirm</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your current password"
                        className="bg-white/10 border-white/20 text-white placeholder-blue-300/50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {deleteError && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                    {deleteError}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancelFinal}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleFinalDelete}
              disabled={isDeleting || confirmationPhrase !== requiredPhrase}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Permanently Erase All Data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DataItem({ icon, label, count, description }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
      <div className="text-blue-400 mt-0.5">{icon}</div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{label}</span>
          <span className="text-blue-300 text-sm bg-white/10 px-2 py-0.5 rounded">{count}</span>
        </div>
        <p className="text-blue-300/70 text-xs mt-0.5">{description}</p>
      </div>
    </div>
  );
}
