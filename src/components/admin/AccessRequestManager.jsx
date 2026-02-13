import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UserPlus,
  Check,
  X,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  Briefcase,
  Mail,
  Calendar,
  Filter,
  RefreshCw,
  User,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AccessRequestManager() {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);

  // Reject dialog state
  const [rejectDialog, setRejectDialog] = useState({ open: false, request: null });
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const status = filter === 'all' ? null : filter;
      const data = await apiClient.admin.getAccessRequests(status);
      setRequests(data.data || []);
    } catch (error) {
      console.error('Failed to load access requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load access requests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (request) => {
    setProcessingId(request.id);
    try {
      await apiClient.admin.approveAccessRequest(request.id);
      toast({
        title: 'Request Approved',
        description: `${request.name} has been granted trial access. An email has been sent.`,
      });
      loadRequests();
    } catch (error) {
      console.error('Failed to approve request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve request',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (request) => {
    setRejectDialog({ open: true, request });
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectDialog.request) return;

    setIsRejecting(true);
    try {
      await apiClient.admin.rejectAccessRequest(
        rejectDialog.request.id,
        rejectReason || null
      );
      toast({
        title: 'Request Rejected',
        description: `${rejectDialog.request.name}'s request has been rejected. An email has been sent.`,
      });
      setRejectDialog({ open: false, request: null });
      loadRequests();
    } catch (error) {
      console.error('Failed to reject request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject request',
        variant: 'destructive',
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-green-500/20 text-green-300 border-green-500/50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/20 text-red-300 border-red-500/50">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-400" />
            Access Requests
            {pendingCount > 0 && filter !== 'pending' && (
              <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50 ml-2">
                {pendingCount} pending
              </Badge>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[150px] bg-white/10 border-white/20 text-white">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={loadRequests}
            disabled={isLoading}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Info card about trial users */}
      <Card className="bg-amber-500/10 border-amber-500/30">
        <CardContent className="p-4">
          <p className="text-amber-200 text-sm">
            <strong>Trial Users:</strong> Approved requests create trial accounts limited to <strong>3 saved deliverables</strong>.
            After reaching this limit, users can only view content. Contact support to upgrade accounts.
          </p>
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="bg-white/10 border-white/20">
          <CardContent className="p-8 text-center">
            <UserPlus className="w-12 h-12 text-blue-400 mx-auto mb-4 opacity-50" />
            <p className="text-blue-200">
              {filter === 'pending'
                ? 'No pending access requests'
                : filter === 'approved'
                ? 'No approved requests'
                : filter === 'rejected'
                ? 'No rejected requests'
                : 'No access requests found'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card
              key={request.id}
              className={`border ${
                request.status === 'pending'
                  ? 'bg-white/10 border-yellow-500/30'
                  : request.status === 'approved'
                  ? 'bg-white/5 border-green-500/20'
                  : 'bg-white/5 border-red-500/20'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusBadge(request.status)}
                      <span className="text-blue-300 text-sm flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(request.createdAt)}
                      </span>
                    </div>

                    <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      {request.name}
                    </h3>

                    <div className="mt-2 space-y-1">
                      <p className="text-blue-300 text-sm flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {request.email}
                      </p>
                      <p className="text-blue-300 text-sm flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {request.company}
                      </p>
                      <p className="text-blue-300 text-sm flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        {request.jobTitle}
                      </p>
                    </div>

                    {/* Show reviewer info for processed requests */}
                    {request.status !== 'pending' && request.reviewedBy && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-blue-400 text-sm">
                          {request.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                          <span className="text-white">{request.reviewedBy}</span>
                          {request.reviewedAt && (
                            <span className="text-blue-300"> on {formatDate(request.reviewedAt)}</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons for pending requests */}
                  {request.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request)}
                        disabled={processingId === request.id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {processingId === request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRejectDialog(request)}
                        disabled={processingId === request.id}
                        className="bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Confirmation Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => !open && setRejectDialog({ open: false, request: null })}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              Reject Access Request
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to reject the request from{' '}
              <span className="text-white font-medium">{rejectDialog.request?.name}</span>?
              They will receive an email notification.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-blue-200">
                Reason (optional)
              </Label>
              <Textarea
                id="reason"
                placeholder="Enter a reason for rejection (will be included in the email)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300 min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ open: false, request: null })}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isRejecting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isRejecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Reject Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
