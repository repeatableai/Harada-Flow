import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from './AuthProvider';

export default function SessionWarning() {
  const { user } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkSession = () => {
      if (!user) return;

      // Only show warning for non-permanent users
      if (!user.isPermanent && user.expiresAt) {
        const remaining = user.expiresAt - Date.now();

        if (remaining > 0) {
          // Show warning if less than 24 hours remaining
          if (remaining < 24 * 60 * 60 * 1000) {
            setShowWarning(true);
            setTimeRemaining(remaining);
          } else {
            setShowWarning(false);
          }
        } else {
          // Session expired
          setShowWarning(false);
        }
      } else {
        setShowWarning(false);
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user]);

  const formatTimeRemaining = (ms) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!showWarning || !timeRemaining) return null;

  return (
    <Alert className="bg-yellow-500/20 border-yellow-500/50 text-yellow-200 m-4">
      <Clock className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          Your session expires in <strong>{formatTimeRemaining(timeRemaining)}</strong>.
          This is a one-time access session.
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowWarning(false)}
          className="text-yellow-200 hover:text-yellow-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
