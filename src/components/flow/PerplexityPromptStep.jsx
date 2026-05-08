/**
 * Perplexity Prompt Step
 *
 * Generates a tailored Perplexity deep research brief based on the client's
 * company context and deliverable. Used in both Working and Executive flows.
 *
 * The user can generate the prompt (recommended) or skip to proceed.
 */

import React, { useState } from 'react';
import { InvokeLLM } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  Copy,
  Check,
  Loader2,
  Search,
  SkipForward,
  Download,
  Sparkles,
  Info,
} from 'lucide-react';
import { downloadMarkdown } from '@/lib/downloadMarkdown';

// The system prompt template will be loaded from the .md file at build time
// For now we import it as a raw string via Vite's ?raw suffix
import perplexityTemplate from '@/prompts/Perplexity_Research_Brief_Template.md?raw';

export default function PerplexityPromptStep({ company, deliverable, onGenerated, onSkip }) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const generatePerplexityPrompt = async () => {
    setIsGenerating(true);
    setError('');

    try {
      // Build inputs from the actual company and deliverable objects
      const inputs = {
        deliverable_name:        deliverable.name || 'Deliverable',
        deliverable_type:        deliverable.type || 'productivity',
        column_name:             deliverable.column || deliverable.category || 'General',
        deliverable_description: deliverable.description || deliverable.name || '',
        is_custom:               String(deliverable.isCustom || false),
        job_title:               company.job_title || 'Executive',
        industry:                company.industry || 'General',
        company_size:            company.company_size || 'Unknown',
        company_url:             company.company_url || 'Not provided',
        dossier_summary:         company.dossier_content
                                   ? company.dossier_content.substring(0, 500)
                                   : 'No dossier available',
      };

      // Interpolate all {{variable}} placeholders in the template
      let rendered = perplexityTemplate;
      for (const [key, value] of Object.entries(inputs)) {
        rendered = rendered.replaceAll(`{{${key}}}`, value);
      }

      const result = await InvokeLLM({
        prompt: rendered,
        add_context_from_internet: !!company.company_url,
        operationType: 'perplexity_research_brief',
        operationName: deliverable.name,
        companyId: company.id,
        industry: company.industry,
        companySize: company.company_size,
        deliverableName: deliverable.name,
      });

      // The LLM returns the brief as plain text (possibly wrapped in backticks)
      const raw = typeof result === 'string' ? result : (result.research_brief || result.text || JSON.stringify(result, null, 2));
      // Strip leading/trailing triple backticks if present
      const brief = raw.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
      setGeneratedPrompt(brief);

      toast({
        title: 'Research brief generated',
        description: 'Copy and paste this into Perplexity deep research.',
        duration: 4000,
      });
    } catch (err) {
      setError(err.message || 'Failed to generate research brief');
      toast({
        title: 'Error',
        description: 'Failed to generate Perplexity research brief.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      toast({ title: 'Research brief copied', duration: 2000 });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const handleProceed = () => {
    if (onGenerated) onGenerated(generatedPrompt);
  };

  // ── Pre-generation view ─────────────────────────────────

  if (!generatedPrompt) {
    return (
      <div className="space-y-4">
        {/* Recommendation notice */}
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-blue-300 text-sm font-medium mb-1">
                  Enhance with Perplexity Deep Research
                </p>
                <p className="text-blue-200/60 text-xs leading-relaxed">
                  This deliverable will be significantly enhanced with real-time research context.
                  Generate a tailored research brief, paste it into Perplexity's deep research feature,
                  and bring the results back into your Claude session before running the DCE prompts.
                  This provides current market data, competitive intelligence, and industry-specific
                  context that makes your deliverable substantially more informed and actionable.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 text-center space-y-4">
            <Search className="w-10 h-10 text-blue-400 mx-auto" />
            <h3 className="text-white font-semibold">Generate Perplexity Research Prompt?</h3>
            <p className="text-blue-200/70 text-sm max-w-md mx-auto">
              We'll create a comprehensive research brief tailored to your deliverable
              that you can paste directly into Perplexity.
            </p>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                onClick={generatePerplexityPrompt}
                disabled={isGenerating}
                className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-3 px-6"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {isGenerating ? 'Generating...' : 'Yes, Generate Research Brief'}
              </Button>

              <Button
                onClick={onSkip}
                variant="ghost"
                className="text-blue-200/50 hover:text-white"
              >
                <SkipForward className="w-4 h-4 mr-2" />
                No, Skip This Step
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Post-generation view ────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Generated prompt card */}
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
                onClick={handleCopy}
                className="text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10"
              >
                {copied ? (
                  <><Check className="w-3 h-3 mr-1" /> Copied</>
                ) : (
                  <><Copy className="w-3 h-3 mr-1" /> Copy</>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadMarkdown(generatedPrompt, `Perplexity-Brief-${deliverable.name}`)}
                className="text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10"
              >
                <Download className="w-3 h-3 mr-1" /> Download
              </Button>
            </div>
          </div>

          <p className="text-blue-200/60 text-xs">
            Copy this brief and paste it into Perplexity's deep research. Bring the results back
            into your Claude session before running the DCE prompts below.
          </p>

          <pre className="text-xs text-blue-200/70 bg-black/30 p-3 rounded overflow-x-auto overflow-y-auto max-h-96 whitespace-pre-wrap font-mono">
            {generatedPrompt}
          </pre>
        </CardContent>
      </Card>

      {/* Continue button */}
      <div className="flex justify-end">
        <Button
          onClick={handleProceed}
          className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold py-3 px-6"
        >
          Continue to DCE Prompts
        </Button>
      </div>
    </div>
  );
}
