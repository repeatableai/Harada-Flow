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
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/api/apiClient';
import { useToast } from '@/components/ui/use-toast';
import GeneratedPrompts from '../deliverable/GeneratedPrompts';
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
} from 'lucide-react';

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

      setGeneratedPrompts(result);

      // Auto-save prompts
      try {
        await SavedPrompt.create(company.id, {
          deliverable_name: deliverable.name,
          deliverable_type: deliverable.type,
          column_name: deliverable.column || null,
          overview: result.overview,
          prompts: result.prompts,
          is_custom: deliverable.isCustom || false,
          custom_input: deliverable.isCustom ? deliverable.name : null,
        });
      } catch {
        // Non-critical
      }

      // Auto-fire ACD + Registry (Executive mode — no user choice)
      try {
        await apiClient.request('/deliverable/working/complete', {
          method: 'POST',
          body: JSON.stringify({
            companyId: company.id,
            deliverableName: deliverable.name,
            acdRegistryChoice: 'C', // Both — auto-fire in Executive mode
          }),
        });
      } catch {
        // Non-critical
      }

      toast({
        title: "Prompts generated",
        description: "8 DCE prompts created. ACD and Registry auto-logged.",
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
            8 DCE prompts + governance blocks
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
            </div>
            <p className="text-blue-200/60 text-xs">
              Paste this dossier into your Claude session first — it provides the company context for everything that follows.
            </p>
            <pre className="text-xs text-blue-200/70 bg-black/30 p-3 rounded overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
              {sessionZeroDossier.substring(0, 500)}{sessionZeroDossier.length > 500 ? '...' : ''}
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
                <pre className="text-xs text-blue-200/70 bg-black/30 p-3 rounded overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                  {block.content.substring(0, 400)}{block.content.length > 400 ? '...' : ''}
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

      {/* Step 2: Generate 8-Prompt Pack */}
      {!generatedPrompts && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 text-center space-y-4">
            <h3 className="text-white font-semibold text-sm">Step 2 — Generate DCE Prompts</h3>
            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-lg font-bold text-white mb-2">{deliverable.name}</h3>
              <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                {deliverable.type === 'productivity' ? 'Productivity Matrix' : 'Performance Matrix'}
              </span>
            </div>
            <p className="text-blue-200/70 text-sm">
              After pasting the governance blocks above, generate 8 comprehensive DCE prompts for this deliverable.
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

      {/* Step 3: Show Generated Prompts */}
      {generatedPrompts && (
        <div className="space-y-3">
          <h3 className="text-white font-semibold text-sm">Step 2 — Your DCE Prompts (paste these after the governance blocks)</h3>
          <GeneratedPrompts prompts={generatedPrompts} onStartOver={onBack} />
        </div>
      )}
    </div>
  );
}
