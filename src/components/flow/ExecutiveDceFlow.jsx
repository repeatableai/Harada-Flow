/**
 * Executive DCE Flow (B.5)
 *
 * Executive mode = the existing 8-prompt DCE generation PLUS Block A and Block B
 * as supplementary copy-paste cards. The comprehensive path.
 *
 * Pre-flight checklist is displayed as informational guidance (not a gate).
 * ACD and Registry auto-fire on completion (no user-elect prompt).
 */

import React, { useState, useEffect } from 'react';
import { InvokeLLM } from '@/api/integrations';
import { SavedPrompt } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/api/apiClient';
import { useToast } from '@/components/ui/use-toast';
import LoadingOverlay from '../common/LoadingOverlay';
import {
  Copy,
  Check,
  Loader2,
  ArrowLeft,
  FileText,
  Crown,
  Info,
  Sparkles,
  Download,
  Search,
} from 'lucide-react';
import { downloadMarkdown } from '@/lib/downloadMarkdown';
import PerplexityPromptStep from './PerplexityPromptStep';

export default function ExecutiveDceFlow({ company, deliverable, sessionZeroDossier, onBack, onComplete }) {
  const { toast } = useToast();

  // 8-prompt generation state (the existing DCE flow)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState(null);

  // Block A + B supplementary cards
  const [blocks, setBlocks] = useState([]);
  const [copiedBlocks, setCopiedBlocks] = useState(new Set());
  const [banner, setBanner] = useState(null);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(true);

  // Perplexity research step state
  const [perplexityBrief, setPerplexityBrief] = useState(null);
  const [perplexityCompleted, setPerplexityCompleted] = useState(false);

  const [copiedSteps, setCopiedSteps] = useState(new Set());

  const [error, setError] = useState('');

  // Load Block A + B on mount
  useEffect(() => {
    loadBlocks();
  }, []);

  const loadBlocks = async () => {
    setIsLoadingBlocks(true);
    try {
      const result = await apiClient.request('/deliverable/executive', {
        method: 'POST',
        body: JSON.stringify({
          companyId: company.id,
          deliverableName: deliverable?.name || 'Executive Deliverable',
        }),
      });
      setBlocks(result.blocks || []);
      setBanner(result.banner || null);
    } catch (err) {
      // Non-critical — blocks are supplementary
      console.error('Failed to load executive blocks:', err);
    } finally {
      setIsLoadingBlocks(false);
    }
  };

  // Generate the 8-prompt DCE pack (the existing core flow)
  const generatePrompts = async () => {
    if (!deliverable || !company) return;
    setIsGenerating(true);
    setError('');

    try {
      const prompt = buildPrompt();

      const result = await InvokeLLM({
        prompt,
        add_context_from_internet: !!company.company_url,
        response_json_schema: {
          type: "object",
          properties: {
            deliverable_name: { type: "string" },
            overview: { type: "string" },
            prompts: {
              type: "array",
              minItems: 8,
              maxItems: 8,
              items: {
                type: "object",
                properties: {
                  step: { type: "number" },
                  title: { type: "string" },
                  description: { type: "string" },
                  prompt: { type: "string" }
                },
                required: ["step", "title", "description", "prompt"]
              }
            }
          },
          required: ["deliverable_name", "overview", "prompts"]
        },
        operationType: 'deliverable_prompts',
        operationName: deliverable.name,
        companyId: company.id,
        industry: company.industry,
        companySize: company.company_size,
        deliverableName: deliverable.name,
      });

      // Merge the three schema sections into a unified prompts array
      // Supports both old shape (result.prompts) and new shape (result.build_prompts + attending_asset_discovery + portfolio_hub)
      let mergedPrompts;
      if (result.build_prompts) {
        const buildPrompts = result.build_prompts.map((p, i) => ({ ...p, step: i + 1 }));
        mergedPrompts = [
          ...buildPrompts,
          {
            step: buildPrompts.length + 1,
            title: result.attending_asset_discovery?.title || 'Attending Asset Discovery',
            description: result.attending_asset_discovery?.description || '',
            prompt: result.attending_asset_discovery?.prompt || '',
          },
          {
            step: buildPrompts.length + 2,
            title: result.portfolio_hub?.title || 'Portfolio Hub',
            description: result.portfolio_hub?.description || '',
            prompt: result.portfolio_hub?.prompt || '',
          },
        ];
      } else {
        mergedPrompts = result.prompts || [];
      }

      const mergedResult = {
        deliverable_name: result.deliverable_name,
        overview: result.overview,
        prompts: mergedPrompts,
      };

      setGeneratedPrompts(mergedResult);

      // Auto-save prompts — include dossier + Block A/B + the generated steps
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

        // Block A & B cards (loaded on mount)
        if (blocks && blocks.length > 0) {
          blocks.forEach((block, i) => {
            allPrompts.push({
              step: allPrompts.length,
              title: block.title || `Block ${String.fromCharCode(65 + i)}`,
              description: block.description || `Supplementary block ${String.fromCharCode(65 + i)}`,
              prompt: block.content || block.prompt || '',
            });
          });
        }

        // Perplexity Research Brief (if generated)
        if (perplexityBrief) {
          allPrompts.push({
            step: allPrompts.length,
            title: 'Perplexity Deep Research Brief',
            description: 'Copy this into Perplexity deep research. Bring the results back into your Claude session before running the executive prompts.',
            prompt: perplexityBrief,
          });
        }

        // Generated prompts (renumber to follow dossier + blocks + perplexity)
        const offset = allPrompts.length;
        mergedPrompts.forEach((p, i) => {
          allPrompts.push({
            ...p,
            step: offset + i + 1,
          });
        });

        await SavedPrompt.create(company.id, {
          deliverable_name: deliverable.name,
          deliverable_type: deliverable.type,
          column_name: deliverable.column || null,
          overview: result.overview,
          prompts: allPrompts,
          is_custom: deliverable.isCustom || false,
          custom_input: deliverable.isCustom ? deliverable.name : null,
        });
      } catch (saveErr) {
        console.error('ExecutiveDceFlow: failed to save prompts:', saveErr);
      }

      toast({
        title: "Prompts generated",
        description: "8 DCE prompts created.",
        duration: 4000,
      });
    } catch (err) {
      setError(err.message || 'Failed to generate prompts');
      toast({
        title: "Error",
        description: "Failed to generate prompts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Build the 8-prompt system prompt (same as DeliverableCreatorStep)
  const buildPrompt = () => {
    return `You are an expert AI consultant specializing in creating detailed, actionable deliverable creation prompts.

CONTEXT:
Role: ${company.job_title}
Industry: ${company.industry}
Company Size: ${company.company_size}
${company.company_url ? `Company URL: ${company.company_url}` : ''}
Selected Deliverable: ${deliverable.name}
Deliverable Type: ${deliverable.type === 'productivity' ? 'Productivity Matrix' : 'Performance Matrix'}
Category: ${deliverable.column || 'General'}

Generate 8 comprehensive, sequential DCE prompts for creating this deliverable.
Each prompt must be self-contained and work in a fresh AI session.

Include Magic Wand vision, Brutal Pre-Mortem, 5-Expert Panel where relevant.
Use [SYN] markers for any synthetic/placeholder data.

Return as JSON with deliverable_name, overview, and prompts array (8 items with step, title, description, prompt).

CRITICAL: Each prompt must be 800-2000+ words of detailed instruction.`;
  };

  const handleCopy = async (block) => {
    try {
      await navigator.clipboard.writeText(block.content);
      setCopiedBlocks(prev => new Set(prev).add(block.name));
      toast({ title: `${block.title} copied`, duration: 2000 });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const handleCopyStep = async (prompt) => {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      setCopiedSteps(prev => new Set(prev).add(prompt.step));
      toast({ title: `Step ${prompt.step} copied`, duration: 2000 });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };


  // ── Render ───────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Loading overlay for prompt generation */}
      {isGenerating && (
        <LoadingOverlay message="Generating 8 comprehensive DCE prompts... This may take 2-3 minutes." />
      )}

      {/* Header */}
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
            8 DCE prompts + governance blocks + research brief
          </span>
        </div>
      </div>

      {/* Pre-flight guidance (informational, not a gate) */}
      {banner && (
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-blue-300 text-sm font-medium mb-1">Pre-Flight Guidance</p>
                <p className="text-blue-200/60 text-xs">
                  For best results with Executive mode, ensure your Claude project has company context files
                  (dossier, client data) uploaded to Project Knowledge before pasting the blocks below.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session 00 — Generated Dossier (paste first if no user files) */}
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
              Paste this dossier into your Claude session first — it provides the company context for everything that follows.
            </p>
            <pre className="text-xs text-blue-200/70 bg-black/30 p-3 rounded overflow-x-auto overflow-y-auto whitespace-pre-wrap font-mono">
              {sessionZeroDossier}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Governance Blocks (A + B) — paste these FIRST */}
      {blocks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Crown className="w-4 h-4 text-purple-400" />
            Step 1 — Governance Blocks (paste these into your Claude session first)
          </h3>
          <p className="text-blue-200/60 text-xs">
            These blocks load the DCE governance framework into your Claude session. Paste them before running the prompts below.
          </p>

          {blocks.map((block) => (
            <Card key={block.name} className="bg-white/5 border-white/10">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-white font-semibold text-sm">{block.title}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(block)}
                      className="text-blue-200 border-blue-400/40 hover:bg-blue-500/20"
                    >
                      {copiedBlocks.has(block.name) ? (
                        <><Check className="w-3 h-3 mr-1" /> Copied</>
                      ) : (
                        <><Copy className="w-3 h-3 mr-1" /> Copy</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadMarkdown(block.content, block.title || block.name)}
                      className="text-blue-200 border-blue-400/40 hover:bg-blue-500/20"
                    >
                      <Download className="w-3 h-3 mr-1" /> Download
                    </Button>
                  </div>
                </div>
                <pre className="text-xs text-blue-200/70 bg-black/30 p-3 rounded overflow-x-auto overflow-y-auto whitespace-pre-wrap font-mono">
                  {block.content}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isLoadingBlocks && (
        <div className="flex items-center gap-2 text-blue-300/50 text-xs">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading governance blocks...
        </div>
      )}

      {/* Step 2: Perplexity Research Brief */}
      {!perplexityCompleted && (
        <div className="space-y-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400" />
            Step 2 — Perplexity Deep Research
          </h3>
          <PerplexityPromptStep
            company={company}
            deliverable={deliverable}
            onGenerated={(brief) => {
              setPerplexityBrief(brief);
              setPerplexityCompleted(true);
            }}
            onSkip={() => setPerplexityCompleted(true)}
          />
        </div>
      )}

      {/* Step 3: Generate 8-Prompt Pack (visible after Perplexity step) */}
      {perplexityCompleted && !generatedPrompts && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 text-center space-y-4">
            <h3 className="text-white font-semibold text-sm">Step 3 — Generate DCE Prompts</h3>
            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-lg font-bold text-white mb-2">{deliverable.name}</h3>
              <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                {deliverable.type === 'productivity' ? 'Productivity Matrix' : 'Performance Matrix'}
              </span>
            </div>
            <p className="text-blue-200/70 text-sm">
              After pasting the governance blocks{perplexityBrief ? ' and Perplexity research results' : ''} above, generate 8 comprehensive DCE prompts for this deliverable.
            </p>
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm">{error}</div>
            )}
            <Button
              onClick={generatePrompts}
              disabled={isGenerating}
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold py-3 px-6"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Executive Prompts
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Show Generated Prompts with completion tracking */}
      {generatedPrompts && (
        <div className="space-y-4">
          <div>
            <h3 className="text-white font-semibold text-sm">Step 3 — Your DCE Prompts (paste these after the governance blocks{perplexityBrief ? ' and research results' : ''})</h3>
            <span className="text-blue-200/50 text-xs">
              {generatedPrompts.prompts.length} steps
            </span>
          </div>

          {/* Overview */}
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <p className="text-blue-200 text-sm leading-relaxed">{generatedPrompts.overview}</p>
            </CardContent>
          </Card>

          {/* Prompt Cards */}
          {generatedPrompts.prompts.map((prompt) => (
            <Card
              key={prompt.step}
              className="border bg-white/5 border-white/10"
            >
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-purple-500/20 px-2 py-0.5 rounded text-purple-300">
                      Step {prompt.step}
                    </span>
                    <span className="text-white text-sm font-medium">{prompt.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyStep(prompt)}
                      className="text-blue-300 border-white/20 hover:bg-white/10"
                    >
                      {copiedSteps.has(prompt.step) ? (
                        <><Check className="w-3 h-3 mr-1" /> Copied</>
                      ) : (
                        <><Copy className="w-3 h-3 mr-1" /> Copy</>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-blue-200/70 text-xs">{prompt.description}</p>

                {/* Content */}
                <pre className="text-xs text-blue-200/70 bg-black/30 p-3 rounded overflow-x-auto overflow-y-auto whitespace-pre-wrap font-mono">
                  {prompt.prompt}
                </pre>
              </CardContent>
            </Card>
          ))}

          {/* How to Use */}
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                How to Use These Requests
              </h3>
              <div className="space-y-1 text-blue-200/70 text-xs">
                <p>• Copy each request in sequential order and paste them into the LLM of your choice.</p>
                <p>• Use the output from each step to inform the next.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
