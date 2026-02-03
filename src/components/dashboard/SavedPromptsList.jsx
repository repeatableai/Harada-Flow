import React, { useState, useEffect } from "react";
import { SavedPrompt } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Copy,
  CheckCircle,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  Briefcase,
  Inbox
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function SavedPromptsList({ onPromptDeleted }) {
  const { toast } = useToast();
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const result = await SavedPrompt.list();
      setPrompts(result);
    } catch (error) {
      console.error("Error loading prompts:", error);
      toast({
        title: "Error",
        description: "Failed to load saved prompts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (prompt) => {
    try {
      setDeleting(true);
      await SavedPrompt.delete(prompt.id);
      setPrompts(prev => prev.filter(p => p.id !== prompt.id));
      toast({
        title: "Prompt deleted",
        description: `Deleted "${prompt.deliverable_name}" prompts`,
      });
      if (onPromptDeleted) {
        onPromptDeleted(prompt.id);
      }
    } catch (error) {
      console.error("Error deleting prompt:", error);
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const copyToClipboard = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast({
        title: "Copied!",
        description: "Prompt copied to clipboard",
      });
    } catch (err) {
      console.error('Failed to copy text:', err);
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const copyAllPrompts = async (savedPrompt) => {
    const allText = savedPrompt.prompts.map((p, i) =>
      `--- Step ${p.step}: ${p.title} ---\n\n${p.prompt}`
    ).join('\n\n');

    try {
      await navigator.clipboard.writeText(allText);
      toast({
        title: "Copied!",
        description: "All prompts copied to clipboard",
      });
    } catch (err) {
      console.error('Failed to copy text:', err);
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

  if (prompts.length === 0) {
    return (
      <Card className="bg-white/5 backdrop-blur-lg border-white/10">
        <CardContent className="py-12 text-center">
          <Inbox className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Saved Prompts</h3>
          <p className="text-gray-400">
            Generate prompts for a deliverable to see them saved here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {prompts.map((savedPrompt, index) => (
            <motion.div
              key={savedPrompt.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-white/5 backdrop-blur-lg border-white/10 hover:bg-white/8 transition-all duration-200">
                <Collapsible
                  open={expandedId === savedPrompt.id}
                  onOpenChange={() => setExpandedId(expandedId === savedPrompt.id ? null : savedPrompt.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                          <CardTitle className="text-lg text-white truncate">
                            {savedPrompt.deliverable_name}
                          </CardTitle>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={`${
                              savedPrompt.deliverable_type === 'productivity'
                                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            }`}
                          >
                            {savedPrompt.deliverable_type === 'productivity' ? 'Productivity' : 'Performance'}
                          </Badge>
                          {savedPrompt.column_name && (
                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                              {savedPrompt.column_name}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            {savedPrompt.prompts?.length || 0} prompts
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white"
                          >
                            {expandedId === savedPrompt.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyAllPrompts(savedPrompt)}
                          className="bg-white/5 border-white/20 text-white hover:bg-white/15"
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Copy All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirm(savedPrompt)}
                          className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {/* Session info */}
                    {savedPrompt.company && (
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          <span>{savedPrompt.company.job_title}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(savedPrompt.created_at)}</span>
                        </div>
                      </div>
                    )}
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {/* Overview */}
                      <div className="mb-4 p-3 bg-white/5 rounded-lg">
                        <p className="text-sm text-gray-300">{savedPrompt.overview}</p>
                      </div>

                      {/* Individual prompts */}
                      <div className="space-y-3">
                        {savedPrompt.prompts?.map((prompt, promptIndex) => (
                          <div
                            key={promptIndex}
                            className="bg-gray-900/50 rounded-lg p-4 border border-white/5"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs">
                                  Step {prompt.step}
                                </Badge>
                                <span className="text-white font-medium">{prompt.title}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(prompt.prompt, `${savedPrompt.id}-${promptIndex}`)}
                                className="text-gray-400 hover:text-white h-7 px-2"
                              >
                                {copiedIndex === `${savedPrompt.id}-${promptIndex}` ? (
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-gray-400 mb-2">{prompt.description}</p>
                            <pre className="text-xs text-gray-200 whitespace-pre-wrap font-mono bg-black/20 p-2 rounded max-h-32 overflow-y-auto">
                              {prompt.prompt}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Saved Prompts?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete the "{deleteConfirm?.deliverable_name}" prompts.
              This action cannot be undone.
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
