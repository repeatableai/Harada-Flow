import React, { useState, useEffect } from "react";
import { Company } from "@/api/entities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Building2,
  Users,
  Calendar,
  Eye,
  Trash2,
  Loader2,
  FolderOpen
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SessionsList({ currentCompanyId, onViewSession, onDeleteSession }) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const result = await Company.list();
      const companies = Array.isArray(result) ? result : (result.data || []);
      setSessions(companies);
    } catch (error) {
      console.error("Error loading sessions:", error);
      toast({
        title: "Error",
        description: "Failed to load roles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (session) => {
    try {
      setDeleting(true);
      await Company.delete(session.id);
      setSessions(prev => prev.filter(s => s.id !== session.id));
      toast({
        title: "Role deleted",
        description: `Deleted "${session.job_title}" role`,
      });
      if (onDeleteSession) {
        onDeleteSession(session.id);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({
        title: "Error",
        description: "Failed to delete role",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card className="bg-white/5 backdrop-blur-lg border-white/10">
        <CardContent className="py-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Roles Yet</h3>
          <p className="text-gray-400">
            Create your first role deliverables matrix to see it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {sessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={`bg-white/5 backdrop-blur-lg border-white/10 hover:bg-white/10 transition-all duration-200 overflow-hidden ${
                  session.id === currentCompanyId ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Job Title */}
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Briefcase className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <h3 className="text-lg font-semibold text-white truncate">
                          {session.job_title}
                        </h3>
                      </div>
                      {session.id === currentCompanyId && (
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                          Current
                        </Badge>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-400 min-w-0">
                        <Building2 className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{session.industry}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Users className="w-4 h-4 flex-shrink-0" />
                        <span>{session.company_size}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span>{formatDate(session.created_date)}</span>
                      </div>
                    </div>

                    {/* Matrix Status */}
                    <div className="flex gap-2">
                      {session.productivity_matrix && (
                        <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                          Productivity
                        </Badge>
                      )}
                      {session.performance_matrix && (
                        <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                          Performance
                        </Badge>
                      )}
                      {!session.productivity_matrix && !session.performance_matrix && (
                        <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">
                          In Progress
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewSession(session)}
                        className="flex-1 bg-white/5 border border-white/20 text-white hover:bg-white/15"
                        disabled={session.id === currentCompanyId}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {session.id === currentCompanyId ? 'Viewing' : 'View'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(session)}
                        className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Role?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete the "{deleteConfirm?.job_title}" role
              and all associated prompts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteConfirm)}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
