import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  LogOut,
  Loader2,
  RefreshCw,
  Check,
  AlertTriangle,
  MapPin,
  Clock,
} from 'lucide-react';

function getDeviceIcon(userAgent) {
  if (!userAgent) return Monitor;
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
    return Smartphone;
  }
  if (ua.includes('ipad') || ua.includes('tablet')) {
    return Tablet;
  }
  return Monitor;
}

export default function SessionsTab() {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTerminating, setIsTerminating] = useState(false);
  const [terminatingSessionId, setTerminatingSessionId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLogoutAllDialog, setShowLogoutAllDialog] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [sessionToLogout, setSessionToLogout] = useState(null);

  const loadSessions = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await apiClient.auth.getSessions();
      setSessions(result.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleLogoutSession = (session) => {
    setSessionToLogout(session);
    setShowLogoutDialog(true);
  };

  const confirmLogoutSession = async () => {
    if (!sessionToLogout) return;

    setShowLogoutDialog(false);
    setTerminatingSessionId(sessionToLogout.id);
    setError('');
    setSuccess('');

    try {
      await apiClient.auth.logoutSession(sessionToLogout.id);
      setSuccess('Session terminated successfully');
      await loadSessions();
    } catch (err) {
      setError(err.message || 'Failed to terminate session');
    } finally {
      setTerminatingSessionId(null);
      setSessionToLogout(null);
    }
  };

  const handleLogoutAllOthers = () => {
    setShowLogoutAllDialog(true);
  };

  const confirmLogoutAllOthers = async () => {
    setShowLogoutAllDialog(false);
    setIsTerminating(true);
    setError('');
    setSuccess('');

    try {
      const result = await apiClient.auth.logoutAllOtherSessions();
      setSuccess(`${result.count} session(s) terminated successfully`);
      await loadSessions();
    } catch (err) {
      setError(err.message || 'Failed to terminate sessions');
    } finally {
      setIsTerminating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="space-y-6">
      {/* Active Sessions */}
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Monitor className="w-5 h-5 text-blue-400" />
                Active Sessions
              </CardTitle>
              <CardDescription className="text-blue-300">
                Devices where you're currently signed in
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadSessions}
                disabled={isLoading}
                className="text-blue-300 hover:text-white hover:bg-white/10"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {otherSessions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogoutAllOthers}
                  disabled={isTerminating}
                  className="border-red-500/50 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                >
                  {isTerminating ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <LogOut className="w-4 h-4 mr-2" />
                  )}
                  Logout All Others
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 text-green-200 text-sm flex items-center gap-2 mb-4">
              <Check className="w-4 h-4" />
              {success}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-blue-300">No active sessions found</div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const DeviceIcon = getDeviceIcon(session.userAgent);
                const isTerminatingThis = terminatingSessionId === session.id;

                return (
                  <div
                    key={session.id}
                    className={`p-4 rounded-lg border ${
                      session.isCurrent
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-2 rounded-lg ${
                            session.isCurrent ? 'bg-green-500/20' : 'bg-white/10'
                          }`}
                        >
                          <DeviceIcon
                            className={`w-6 h-6 ${
                              session.isCurrent ? 'text-green-400' : 'text-blue-300'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{session.userAgent}</p>
                            {session.isCurrent && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-500/20 text-green-200 text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Current Session
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-blue-300">
                            {session.ipAddress && (
                              <span className="flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                {session.ipAddress}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Started {formatDate(session.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {!session.isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLogoutSession(session)}
                          disabled={isTerminatingThis}
                          className="text-red-300 hover:text-red-200 hover:bg-red-500/20"
                        >
                          {isTerminatingThis ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <LogOut className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Tip */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-200 text-sm font-medium">Security Tip</p>
              <p className="text-blue-300/80 text-sm mt-1">
                If you see a session you don't recognize, terminate it immediately and change your
                password. This could indicate unauthorized access to your account.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logout Single Session Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Terminate Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300">
              This will sign out the device. The user will need to sign in again on that device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLogoutSession}
              className="bg-red-600 hover:bg-red-700"
            >
              Terminate Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logout All Others Dialog */}
      <AlertDialog open={showLogoutAllDialog} onOpenChange={setShowLogoutAllDialog}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Terminate All Other Sessions?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300">
              This will sign out all other devices. You will remain signed in on this device, but
              all other sessions will be terminated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLogoutAllOthers}
              className="bg-red-600 hover:bg-red-700"
            >
              Terminate All Others
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
