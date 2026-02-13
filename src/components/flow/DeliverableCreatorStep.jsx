import React, { useState, useEffect } from "react";
import { InvokeLLM } from "@/api/integrations";
import { SavedPrompt } from "@/api/entities";
import { apiClient } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, ArrowLeft, Sparkles, FileText, FolderOpen, Bookmark, Plus, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";

import DeliverableSelector from "../deliverable/DeliverableSelector";
import GeneratedPrompts from "../deliverable/GeneratedPrompts";
import LoadingOverlay from "../common/LoadingOverlay";
import SessionsList from "../dashboard/SessionsList";
import SavedPromptsList from "../dashboard/SavedPromptsList";

export default function DeliverableCreatorStep({ company, onStartOver, onLoadSession, onDeleteSession }) {
  const { toast } = useToast();
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);
  const [generatedPrompts, setGeneratedPrompts] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState('select'); // select, generate, view
  const [activeTab, setActiveTab] = useState('create');
  const [trialStatus, setTrialStatus] = useState(null);

  // Check trial user status on mount
  useEffect(() => {
    const checkTrialStatus = async () => {
      try {
        const status = await apiClient.auth.getTrialStatus();
        setTrialStatus(status);
      } catch (error) {
        console.error("Failed to check trial status:", error);
      }
    };
    checkTrialStatus();
  }, []);

  if (!company) {
    return <LoadingOverlay message="Loading session..." />;
  }
  
  const { productivity_matrix, performance_matrix } = company;

  const generatePrompts = async () => {
    if (!selectedDeliverable || !company) return;
    
    setIsGenerating(true);
    
    try {
      const prompt = `
Role: ${company.job_title}
Company Size: ${company.company_size}
Industry: ${company.industry}
Selected Deliverable: ${selectedDeliverable.name}
Matrix Type: ${selectedDeliverable.type}
${company.company_url ? `Company URL: ${company.company_url}` : ''}

Generate a 7-prompt DCE (Deliverable Creation Engine) pack for creating this deliverable. Each prompt follows the DCE methodology which ensures high-quality outputs through iterative refinement.

DCE RULES (embed these in each prompt):
1. Single-question MCQ only - Never ask multiple questions. One clear multiple-choice question at the end.
2. Output format must include these blocks:
   - [ARTIFACT] - The actual deliverable content
   - [TIME_STUDY] - Estimated time saved vs manual creation
   - [QUESTION] - Single MCQ for user decision (A/B/C/D options)
3. Website context safety - If company URL provided, reference it but never assume facts not stated.
4. Completion-first - Always produce a complete draft, never outlines or bullet points only.

Generate exactly 7 prompts in this structure:

PROMPT 1: Context Distillation + Spec + Initial Time Study
- Gather all context about the role, deliverable purpose, and audience
- Create detailed specification for the deliverable
- Estimate baseline manual creation time
- Question: Confirm spec accuracy or adjust focus area

PROMPT 2: Generate Version 1 Deliverable
- Produce complete first draft based on spec
- Apply industry best practices
- Include all required sections
- Question: Overall direction feedback (more detailed/more concise/different angle)

PROMPT 3: Expert QA Review + Approval Gate
- Review V1 as domain expert would
- Identify gaps, inconsistencies, improvements
- Score quality on key dimensions
- Question: Approve for refinement or major pivot needed

PROMPT 4: Implement Changes → Version 2
- Apply all QA feedback
- Enhance weak areas identified
- Strengthen examples and specifics
- Question: Focus area for final polish

PROMPT 5: Simulation Stress Test → Version 3
- Simulate real-world usage scenarios
- Test edge cases and exceptions
- Validate practical applicability
- Question: Stress test priority (usability/completeness/accuracy)

PROMPT 6: Pre-mortem + Edit Gate
- Anticipate what could go wrong with this deliverable
- Identify potential criticisms or gaps
- Propose preventive enhancements
- Question: Accept final edits or request specific changes

PROMPT 7: Final Deliverable + Time Study
- Produce polished final version
- Calculate actual time spent vs baseline
- Summarize key improvements made
- Provide implementation guidance

Return the data in JSON format with this structure:
{
  "deliverable_name": "${selectedDeliverable.name}",
  "overview": "Brief overview of this DCE prompt pack and expected outcomes",
  "prompts": [
    {
      "step": 1,
      "title": "Context Distillation + Spec",
      "description": "What this step accomplishes in the DCE workflow",
      "prompt": "The complete prompt to copy and paste, including DCE rules and output format requirements"
    }
  ]
}
`;

      const result = await InvokeLLM({
        prompt: prompt,
        add_context_from_internet: !!company.company_url,
        response_json_schema: {
          type: "object",
          properties: {
            deliverable_name: { type: "string" },
            overview: { type: "string" },
            prompts: {
              type: "array",
              minItems: 7,
              maxItems: 7,
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
        // Time study tracking
        operationType: 'deliverable_prompts',
        operationName: selectedDeliverable.name,
        companyId: company.id,
        // Dynamic baseline params
        industry: company.industry,
        companySize: company.company_size,
        deliverableName: selectedDeliverable.name,
      });

      setGeneratedPrompts(result);
      setStep('view');

      // Auto-save the generated prompts
      try {
        await SavedPrompt.create(company.id, {
          deliverable_name: selectedDeliverable.name,
          deliverable_type: selectedDeliverable.type,
          column_name: selectedDeliverable.column || null,
          overview: result.overview,
          prompts: result.prompts,
        });
        toast({
          title: "Prompts saved",
          description: "Your prompts have been saved to your library",
        });
      } catch (saveError) {
        console.error("Error auto-saving prompts:", saveError);
        // Don't show error toast - prompts were generated successfully
      }
    } catch (error) {
      console.error("Error generating prompts:", error);

      // Check if it's a trial limit error
      if (error.status === 403 && error.message?.includes('Trial account limit')) {
        toast({
          title: "Trial Limit Reached",
          description: "You have reached your trial account limit. Please contact an administrator to upgrade your account.",
          variant: "destructive",
        });
        // Refresh trial status
        try {
          const status = await apiClient.auth.getTrialStatus();
          setTrialStatus(status);
        } catch (e) {
          // Ignore refresh error
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to generate prompts. Please try again.",
          variant: "destructive",
        });
      }
    }
    
    setIsGenerating(false);
  };

  const resetSelection = () => {
    setSelectedDeliverable(null);
    setGeneratedPrompts(null);
    setStep('select');
  };

  const isTrialLimitReached = trialStatus?.isTrialUser && !trialStatus?.canSave;

  const renderCreateTab = () => (
    <>
      <AnimatePresence>
        {isGenerating && (
          <LoadingOverlay message="Generating comprehensive prompts for your deliverable..." />
        )}
      </AnimatePresence>

      {/* Trial User Limit Warning */}
      {isTrialLimitReached && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card className="bg-amber-500/20 border-amber-500/50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-amber-200 font-medium">Trial Account Limit Reached</p>
                <p className="text-amber-300/80 text-sm">
                  You have saved {trialStatus.deliverablesUsed} of {trialStatus.deliverableLimit} deliverables.
                  Please contact an administrator to upgrade your account for full access.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {step === 'select' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <DeliverableSelector
            productivityMatrix={productivity_matrix}
            performanceMatrix={performance_matrix}
            onSelect={(deliverable) => {
              setSelectedDeliverable(deliverable);
              setStep('generate');
            }}
          />
        </motion.div>
      )}

      {step === 'generate' && selectedDeliverable && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 w-full max-w-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-white flex items-center justify-center gap-2">
                <FileText className="w-6 h-6 text-blue-400" />
                Selected Deliverable
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="bg-white/5 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-2">
                  {selectedDeliverable.name}
                </h3>
                <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                  {selectedDeliverable.type === 'productivity' ? 'Productivity Matrix' : 'Performance Matrix'}
                </Badge>
                {selectedDeliverable.column && (
                  <p className="text-blue-200 mt-2">
                    From: {selectedDeliverable.column}
                  </p>
                )}
              </div>
              <p className="text-blue-200">
                We'll generate detailed, sequential prompts that you can copy and paste into any LLM to create this deliverable.
              </p>
              <div className="flex gap-4 justify-center">
                <Button variant="ghost" onClick={resetSelection} className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
                  Choose Different
                </Button>
                <Button
                  onClick={generatePrompts}
                  disabled={isTrialLimitReached}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  {isTrialLimitReached ? 'Limit Reached' : 'Generate Prompts'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {step === 'view' && generatedPrompts && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <GeneratedPrompts prompts={generatedPrompts} onStartOver={resetSelection} />
        </motion.div>
      )}
    </>
  );

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Button
              variant="ghost"
              onClick={() => onStartOver(company)}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Matrices
            </Button>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-lg rounded-full px-4 py-2">
              <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                {company.job_title}
              </Badge>
              <span className="text-blue-200">•</span>
              <span className="text-blue-200">{company.industry}</span>
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            <Target className="inline-block w-8 h-8 mr-3 text-blue-400" />
            Deliverable Prompts
          </h1>
          <p className="text-blue-200 max-w-2xl mx-auto">
            Create new prompts, browse past sessions, or view your saved prompts library
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-white/10 border border-white/20">
              <TabsTrigger
                value="create"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-gray-300"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create
              </TabsTrigger>
              <TabsTrigger
                value="sessions"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-gray-300"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Sessions
              </TabsTrigger>
              <TabsTrigger
                value="prompts"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-gray-300"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Prompts
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="create" className="mt-0">
            {renderCreateTab()}
          </TabsContent>

          <TabsContent value="sessions" className="mt-0">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">Your Sessions</h2>
                <p className="text-gray-400">
                  View and switch between your saved role deliverables matrices
                </p>
              </div>
              <SessionsList
                currentCompanyId={company?.id}
                onViewSession={(session) => {
                  if (onLoadSession) {
                    onLoadSession(session);
                  }
                }}
                onDeleteSession={(sessionId) => {
                  if (onDeleteSession) {
                    onDeleteSession(sessionId);
                  }
                }}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="prompts" className="mt-0">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">Saved Prompts</h2>
                <p className="text-gray-400">
                  All your generated deliverable prompts across all sessions
                </p>
              </div>
              <SavedPromptsList />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}