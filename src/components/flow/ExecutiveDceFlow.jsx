/**
 * Executive DCE Flow (B.5)
 *
 * Pre-check panel gates the flow until all required project knowledge files
 * are present. Then renders Block A and Block B as copy-paste cards.
 * ACD and Registry auto-fire (no user-elect in Executive mode).
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/api/apiClient';
import { useToast } from '@/components/ui/use-toast';
import {
  Copy,
  Check,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  Upload,
  FileText,
  Crown,
} from 'lucide-react';

export default function ExecutiveDceFlow({ company, deliverable, onBack, onComplete }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState(null); // 'blocked' | 'ready'
  const [missingFiles, setMissingFiles] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [completedBlocks, setCompletedBlocks] = useState(new Set());
  const [copiedBlocks, setCopiedBlocks] = useState(new Set());
  const [error, setError] = useState('');

  const allComplete = blocks.length > 0 && completedBlocks.size === blocks.length;

  useEffect(() => {
    loadExecutiveFlow();
  }, []);

  const loadExecutiveFlow = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await apiClient.request('/deliverable/executive', {
        method: 'POST',
        body: JSON.stringify({
          companyId: company.id,
          deliverableName: deliverable?.name || 'Executive Deliverable',
        }),
      });

      setStatus(result.status);
      if (result.status === 'blocked') {
        setMissingFiles(result.missingFiles || []);
      } else {
        setBlocks(result.blocks || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load Executive flow');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (block) => {
    try {
      await navigator.clipboard.writeText(block.content);
      setCopiedBlocks(prev => new Set(prev).add(block.name));
      toast({ title: `${block.title} copied`, duration: 2000 });
    } catch {
      toast({ title: 'Copy failed — try selecting manually', variant: 'destructive' });
    }
  };

  const toggleBlockComplete = (blockName) => {
    setCompletedBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(blockName)) {
        newSet.delete(blockName);
      } else {
        newSet.add(blockName);
      }
      return newSet;
    });
  };

  const handleComplete = () => {
    toast({
      title: 'Executive Flow Complete',
      description: 'ACD and Registry will auto-fire for any artifacts generated.',
      duration: 4000,
    });
    if (onComplete) onComplete('executive');
  };

  // ── Loading ──────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-4" />
        <p className="text-purple-300 font-medium">Running pre-flight checks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 mb-4">{error}</div>
        <Button variant="outline" onClick={onBack} className="text-white border-white/20">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Matrix
        </Button>
      </div>
    );
  }

  // ── Blocked — Missing Files ──────────────────────────────

  if (status === 'blocked') {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" onClick={onBack} className="text-blue-300 hover:text-white -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Matrix
        </Button>

        <Card className="bg-red-500/5 border-red-500/30">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-300 font-semibold">
              <ShieldAlert className="w-5 h-5" />
              Pre-Flight Check Failed
            </div>
            <p className="text-blue-200/70 text-sm">
              The following files must be uploaded before proceeding with Executive DCE mode:
            </p>
            <ul className="space-y-2">
              {missingFiles.map((file, i) => (
                <li key={i} className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-300 text-sm">
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  {file}
                </li>
              ))}
            </ul>
            <p className="text-blue-200/50 text-xs">
              Upload the missing files to your knowledge library, then try again.
            </p>
            <Button onClick={loadExecutiveFlow} variant="outline" className="text-white border-white/20">
              Re-run Pre-Flight Check
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Ready — Block Cards ──────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button variant="ghost" onClick={onBack} className="text-blue-300 hover:text-white mb-2 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Matrix
          </Button>
          <h2 className="text-xl font-bold text-white">{deliverable?.name || 'Executive DCE'}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 flex items-center gap-1">
              <Crown className="w-3 h-3" /> Executive Mode
            </span>
            <span className="text-blue-200/50 text-xs">
              {blocks.length} blocks — {completedBlocks.size} of {blocks.length} complete
            </span>
          </div>
        </div>
      </div>

      {/* Pre-flight success */}
      <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded text-green-300 text-sm">
        <ShieldCheck className="w-4 h-4" />
        Pre-flight check passed — all required files are in place.
      </div>

      {/* Block Cards */}
      {blocks.map((block) => (
        <Card
          key={block.name}
          className={`border transition-all ${
            completedBlocks.has(block.name)
              ? 'bg-green-500/5 border-green-500/30'
              : 'bg-white/5 border-white/10'
          }`}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold text-sm">{block.title}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(block)}
                className="text-blue-300 border-white/20 hover:bg-white/10"
              >
                {copiedBlocks.has(block.name) ? (
                  <><Check className="w-3 h-3 mr-1" /> Copied</>
                ) : (
                  <><Copy className="w-3 h-3 mr-1" /> Copy</>
                )}
              </Button>
            </div>

            <pre className="text-xs text-blue-200/70 bg-black/30 p-3 rounded overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
              {block.content.substring(0, 500)}{block.content.length > 500 ? '...' : ''}
            </pre>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id={`block-${block.name}`}
                checked={completedBlocks.has(block.name)}
                onCheckedChange={() => toggleBlockComplete(block.name)}
              />
              <label htmlFor={`block-${block.name}`} className="text-sm text-blue-200/70 cursor-pointer">
                I've run this block
              </label>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Completion */}
      {allComplete && (
        <Card className="bg-purple-500/5 border-purple-500/30">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-purple-300 font-semibold">
              <Crown className="w-5 h-5" />
              All Blocks Complete
            </div>
            <p className="text-blue-200/70 text-sm">
              ACD and Registry will auto-fire for any artifacts generated in this Executive session.
              No additional user action required.
            </p>
            <Button
              onClick={handleComplete}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              Complete Executive Flow
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
