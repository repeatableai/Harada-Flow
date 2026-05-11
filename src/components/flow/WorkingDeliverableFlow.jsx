/**
 * Working Deliverable Flow (B.4) — Parallel + Progressive
 *
 * Fires Perplexity brief generation AND chunk generation in parallel.
 * Chunks stream progressively via SSE — each chunk appears as soon as
 * it's parsed on the backend, so the user can start reading/copying
 * while the rest are still generating.
 */

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/api/apiClient';
import { SavedPrompt } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import {
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  Sparkles,
  Download,
  Search,
  SkipForward,
} from 'lucide-react';
import { downloadMarkdown } from '@/lib/downloadMarkdown';
import { generatePerplexityBrief } from '@/utils/generatePerplexityBrief';

export default function WorkingDeliverableFlow({ company, deliverable, sessionZeroDossier, onBack, onComplete }) {
  const { toast } = useToast();

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [perplexityLoading, setPerplexityLoading] = useState(false);
  const [chunks, setChunks] = useState([]);
  const [perplexityBrief, setPerplexityBrief] = useState(null);
  const [chunksComplete, setChunksComplete] = useState(false);
  const [generationStarted, setGenerationStarted] = useState(false);

  // Interaction state
  const [completedChunks, setCompletedChunks] = useState(new Set());
  const [copiedChunks, setCopiedChunks] = useState(new Set());
  const [acdChoice, setAcdChoice] = useState('C');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [perplexityError, setPerplexityError] = useState('');

  // Ref to track if save has been done (both tasks must complete)
  const saveRef = useRef({ chunks: null, perplexityBrief: null, saved: false });

  const allComplete = chunks.length > 0 && chunksComplete && completedChunks.size === chunks.length;

  /**
   * Stream chunks from the backend via SSE.
   * Each chunk is appended to state as it arrives.
   */
  const generateChunksSSE = () => {
    return new Promise((resolve, reject) => {
      const allChunks = [];
      apiClient.requestSSE(
        '/deliverable/working',
        {
          method: 'POST',
          body: JSON.stringify({
            companyId: company.id,
            deliverableName: deliverable.name,
            deliverableType: deliverable.type,
            category: deliverable.column || deliverable.category,
            description: deliverable.description || deliverable.name,
          }),
        },
        // onProgress — also handles 'chunk' events via the extended handler below
        null,
      ).then((completeData) => {
        // requestSSE resolves with the 'complete' event data
        // But chunks were already streamed — resolve with collected chunks
        resolve(allChunks);
      }).catch(reject);

      // We need a different approach since requestSSE only handles progress/complete/error.
      // Let's use a raw SSE fetch instead for chunk streaming.
    });
  };

  /**
   * Raw SSE fetch for progressive chunk streaming.
   * Handles custom 'chunk' events that requestSSE doesn't support.
   */
  const streamChunks = async () => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const headers = { 'Content-Type': 'application/json' };
    if (apiClient.accessToken) {
      headers['Authorization'] = `Bearer ${apiClient.accessToken}`;
    }

    const response = await fetch(`${API_BASE}/deliverable/working`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        companyId: company.id,
        deliverableName: deliverable.name,
        deliverableType: deliverable.type,
        category: deliverable.column || deliverable.category,
        description: deliverable.description || deliverable.name,
      }),
    });

    if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || err.message || 'Failed to generate chunks');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventType = null;
    const collectedChunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          let data;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (eventType === 'chunk') {
            collectedChunks.push(data);
            // Progressively update state — each chunk appears immediately
            setChunks(prev => [...prev, data]);
          } else if (eventType === 'error') {
            throw new Error(data.message || 'Chunk generation failed');
          }
          // 'progress' and 'complete' events are handled implicitly
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          let data;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (eventType === 'chunk') {
            collectedChunks.push(data);
            setChunks(prev => [...prev, data]);
          } else if (eventType === 'error') {
            throw new Error(data.message || 'Chunk generation failed');
          }
        }
      }
    }

    return collectedChunks;
  };

  /**
   * Save prompts once both parallel tasks have finished (or chunks alone if Perplexity was skipped).
   */
  const savePrompts = async (finalChunks, brief) => {
    try {
      const allPrompts = [];

      // Step 0: Session 00 Dossier (if generated)
      if (sessionZeroDossier) {
        allPrompts.push({
          step: 0,
          title: 'Session 00 — Company Dossier',
          description: 'Paste this dossier into your Claude session first — it provides the company context for everything that follows.',
          prompt: sessionZeroDossier,
        });
      }

      // Perplexity Research Brief (if generated)
      if (brief) {
        allPrompts.push({
          step: allPrompts.length,
          title: 'Perplexity Deep Research Brief',
          description: 'Copy this into Perplexity deep research. Bring the results back into your Claude session before running the prompts below.',
          prompt: brief,
        });
      }

      // Working mode chunks
      const offset = allPrompts.length;
      finalChunks.forEach((chunk, i) => {
        allPrompts.push({
          step: offset + (chunk.number || i + 1),
          title: chunk.purpose || `Chunk ${chunk.number || i + 1}`,
          description: `Chunk ${chunk.number || i + 1} of ${chunk.total || finalChunks.length}`,
          prompt: chunk.content || '',
        });
      });

      await SavedPrompt.create(company.id, {
        deliverable_name: deliverable.name,
        deliverable_type: deliverable.type,
        column_name: deliverable.column || deliverable.category || null,
        overview: `Working mode — ${finalChunks.length} prompt chunks for ${deliverable.name}`,
        prompts: allPrompts,
        is_custom: deliverable.isCustom || false,
        custom_input: deliverable.isCustom ? deliverable.name : null,
      });
    } catch (saveErr) {
      console.error('WorkingDeliverableFlow: failed to save prompts:', saveErr);
    }
  };

  /**
   * Fire both Perplexity and chunk generation in parallel.
   */
  const handleGenerate = async (includePerplexity = true) => {
    setIsGenerating(true);
    setGenerationStarted(true);
    setError('');
    setPerplexityError('');
    setChunks([]);
    setChunksComplete(false);

    // Build parallel tasks
    const tasks = [];

    // Task 1: Chunk generation (always runs) — progressive SSE streaming
    setChunksLoading(true);
    const chunkTask = streamChunks()
      .then((finalChunks) => {
        setChunksLoading(false);
        setChunksComplete(true);
        return finalChunks;
      })
      .catch((err) => {
        setChunksLoading(false);
        setError(err.message || 'Failed to generate chunks');
        return [];
      });
    tasks.push(chunkTask);

    // Task 2: Perplexity brief (optional, runs in parallel)
    let perplexityTask = Promise.resolve(null);
    if (includePerplexity) {
      setPerplexityLoading(true);
      perplexityTask = generatePerplexityBrief({ company, deliverable })
        .then((brief) => {
          setPerplexityBrief(brief);
          setPerplexityLoading(false);
          return brief;
        })
        .catch((err) => {
          setPerplexityLoading(false);
          setPerplexityError(err.message || 'Failed to generate research brief');
          return null;
        });
      tasks.push(perplexityTask);
    }

    // Wait for both to complete, then save
    const [finalChunks, brief] = await Promise.all([chunkTask, perplexityTask]);

    if (finalChunks.length > 0) {
      await savePrompts(finalChunks, brief);
      toast({
        title: 'Prompts generated',
        description: `${finalChunks.length} chunks ready${brief ? ' + research brief' : ''}.`,
        duration: 3000,
      });
    }

    setIsGenerating(false);
  };

  const handleCopy = async (chunk) => {
    try {
      await navigator.clipboard.writeText(chunk.content);
      setCopiedChunks(prev => new Set(prev).add(chunk.number));
      toast({ title: `Chunk ${chunk.number} copied`, duration: 2000 });
    } catch {
      toast({ title: 'Copy failed — try selecting manually', variant: 'destructive' });
    }
  };

  const toggleChunkComplete = (chunkNumber) => {
    setCompletedChunks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chunkNumber)) {
        newSet.delete(chunkNumber);
      } else {
        newSet.add(chunkNumber);
      }
      return newSet;
    });
  };

  const handleSubmitCompletion = async () => {
    setIsSubmitting(true);
    try {
      await apiClient.request('/deliverable/working/complete', {
        method: 'POST',
        body: JSON.stringify({
          companyId: company.id,
          deliverableName: deliverable.name,
          acdRegistryChoice: acdChoice,
        }),
      });

      const choiceLabels = { A: 'ACD generated', B: 'Logged to registry', C: 'ACD + registry', D: 'Skipped' };
      toast({
        title: 'Deliverable Complete',
        description: choiceLabels[acdChoice],
        duration: 3000,
      });

      if (onComplete) onComplete(acdChoice);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Pre-generation view ─────────────────────────────────

  if (!generationStarted) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <Button variant="ghost" onClick={onBack} className="text-blue-300 hover:text-white mb-2 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Matrix
          </Button>
          <h2 className="text-xl font-bold text-white">{deliverable.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-300">
              Working Mode
            </span>
          </div>
        </div>

        {/* Generate card */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 text-center space-y-4">
            <Sparkles className="w-10 h-10 text-blue-400 mx-auto" />
            <h3 className="text-white font-semibold">Generate Working Prompts</h3>
            <p className="text-blue-200/70 text-sm max-w-md mx-auto">
              This will generate 3-7 copy-paste prompt chunks for your deliverable.
              You can also include a Perplexity research brief — both generate simultaneously
              so you're not waiting twice.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                onClick={() => handleGenerate(true)}
                className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-3 px-6"
              >
                <Search className="w-4 h-4 mr-2" />
                Generate with Research Brief
              </Button>

              <Button
                onClick={() => handleGenerate(false)}
                variant="ghost"
                className="text-blue-200/50 hover:text-white"
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Generate without Research
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Generation in progress / results ────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button variant="ghost" onClick={onBack} className="text-blue-300 hover:text-white mb-2 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Matrix
          </Button>
          <h2 className="text-xl font-bold text-white">{deliverable.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-300">
              Working Mode
            </span>
            {chunksComplete && (
              <span className="text-blue-200/50 text-xs">
                {chunks.length} chunks — {completedChunks.size} of {chunks.length} complete
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Parallel generation status bar */}
      {isGenerating && (
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-blue-300 font-medium text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating in parallel...
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className={`flex items-center gap-2 ${chunksLoading ? 'text-blue-300' : 'text-green-400'}`}>
                {chunksLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Prompt Chunks {chunks.length > 0 && chunksLoading ? `(${chunks.length} so far)` : chunksComplete ? `(${chunks.length} done)` : ''}
              </div>
              {perplexityLoading !== false && (
                <div className={`flex items-center gap-2 ${perplexityLoading ? 'text-blue-300' : perplexityBrief ? 'text-green-400' : perplexityError ? 'text-red-400' : 'text-blue-200/50'}`}>
                  {perplexityLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : perplexityBrief ? <Check className="w-3 h-3" /> : null}
                  Research Brief {perplexityError ? '(failed)' : ''}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">{error}</div>
      )}

      {/* Session 00 — Generated Dossier */}
      {sessionZeroDossier && (
        <Card className="bg-purple-500/5 border-purple-500/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-purple-500/20 px-2 py-0.5 rounded text-purple-300">
                  Session 00
                </span>
                <span className="text-white text-sm font-medium">Company Dossier</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(sessionZeroDossier);
                      toast({ title: 'Session 00 Dossier copied', duration: 2000 });
                    } catch {
                      toast({ title: 'Copy failed', variant: 'destructive' });
                    }
                  }}
                  className="text-purple-300 border-purple-500/30 hover:bg-purple-500/10"
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadMarkdown(sessionZeroDossier, company?.name || 'Company-Dossier')}
                  className="text-purple-300 border-purple-500/30 hover:bg-purple-500/10"
                >
                  <Download className="w-3 h-3 mr-1" /> Download
                </Button>
              </div>
            </div>
            <p className="text-blue-200/60 text-xs">
              Paste this dossier into your Claude session first — it provides the company context for all subsequent prompts.
            </p>
            <pre className="text-xs text-blue-200/70 bg-black/30 p-3 rounded overflow-x-auto overflow-y-auto whitespace-pre-wrap font-mono">
              {sessionZeroDossier}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Perplexity Research Brief (appears as soon as it's ready) */}
      {perplexityBrief && (
        <Card className="bg-cyan-500/5 border-cyan-500/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-cyan-500/20 px-2 py-0.5 rounded text-cyan-300">
                  Perplexity Brief
                </span>
                <span className="text-white text-sm font-medium">
                  Deep Research Prompt — {deliverable.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(perplexityBrief);
                      toast({ title: 'Research brief copied', duration: 2000 });
                    } catch {
                      toast({ title: 'Copy failed', variant: 'destructive' });
                    }
                  }}
                  className="text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10"
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadMarkdown(perplexityBrief, `Perplexity-Brief-${deliverable.name}`)}
                  className="text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10"
                >
                  <Download className="w-3 h-3 mr-1" /> Download
                </Button>
              </div>
            </div>
            <p className="text-blue-200/60 text-xs">
              Copy this brief and paste it into Perplexity's deep research. Bring the results back
              into your Claude session before running the prompts below.
            </p>
            <pre className="text-xs text-blue-200/70 bg-black/30 p-3 rounded overflow-x-auto overflow-y-auto max-h-96 whitespace-pre-wrap font-mono">
              {perplexityBrief}
            </pre>
          </CardContent>
        </Card>
      )}

      {perplexityError && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-xs">
          Research brief generation failed: {perplexityError}. Chunks are unaffected.
        </div>
      )}

      {/* Chunk Cards — appear progressively as they stream in */}
      {chunks.map((chunk) => (
        <Card
          key={chunk.number}
          className={`border transition-all ${
            completedChunks.has(chunk.number)
              ? 'bg-green-500/5 border-green-500/30'
              : 'bg-white/5 border-white/10'
          }`}
        >
          <CardContent className="p-4 space-y-3">
            {/* Chunk header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-blue-300">
                  {chunk.number}/{chunk.total}
                </span>
                <span className="text-white text-sm font-medium">{chunk.purpose}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(chunk)}
                  className="text-blue-300 border-white/20 hover:bg-white/10"
                >
                  {copiedChunks.has(chunk.number) ? (
                    <><Check className="w-3 h-3 mr-1" /> Copied</>
                  ) : (
                    <><Copy className="w-3 h-3 mr-1" /> Copy</>
                  )}
                </Button>
              </div>
            </div>

            {/* MCQ Warning */}
            {chunk.containsMcq && (
              <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                This chunk contains an MCQ — complete it before advancing.
              </div>
            )}

            {/* Content preview */}
            <pre className="text-xs text-blue-200/70 bg-black/30 p-3 rounded overflow-x-auto overflow-y-auto whitespace-pre-wrap font-mono">
              {chunk.content}
            </pre>

            {/* Complete checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id={`chunk-${chunk.number}`}
                checked={completedChunks.has(chunk.number)}
                onCheckedChange={() => toggleChunkComplete(chunk.number)}
              />
              <label htmlFor={`chunk-${chunk.number}`} className="text-sm text-blue-200/70 cursor-pointer">
                I've run this chunk
              </label>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Still generating indicator at bottom of chunk list */}
      {chunksLoading && chunks.length > 0 && (
        <div className="flex items-center gap-2 text-blue-300/60 text-xs py-2 justify-center">
          <Loader2 className="w-3 h-3 animate-spin" />
          More chunks generating...
        </div>
      )}

      {/* Completion Panel */}
      {allComplete && (
        <Card className="bg-purple-500/5 border-purple-500/30">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-purple-300 font-semibold">
              <ClipboardCheck className="w-5 h-5" />
              All Chunks Complete
            </div>

            <p className="text-blue-200/70 text-sm">
              This deliverable is complete. What would you like to do?
            </p>

            <RadioGroup value={acdChoice} onValueChange={setAcdChoice} className="space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="A" id="choice-a" />
                <Label htmlFor="choice-a" className="text-white text-sm">(A) Generate companion ACD</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="B" id="choice-b" />
                <Label htmlFor="choice-b" className="text-white text-sm">(B) Log to artifact registry</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="C" id="choice-c" />
                <Label htmlFor="choice-c" className="text-white text-sm">(C) Both</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="D" id="choice-d" />
                <Label htmlFor="choice-d" className="text-white text-sm">(D) Skip</Label>
              </div>
            </RadioGroup>

            <Button
              onClick={handleSubmitCompletion}
              disabled={isSubmitting}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Complete Deliverable
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
