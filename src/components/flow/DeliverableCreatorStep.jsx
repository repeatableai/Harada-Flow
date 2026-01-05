import React, { useState, useEffect } from "react";
import { InvokeLLM } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, ArrowLeft, Sparkles, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import DeliverableSelector from "../deliverable/DeliverableSelector";
import GeneratedPrompts from "../deliverable/GeneratedPrompts";
import LoadingOverlay from "../common/LoadingOverlay";

export default function DeliverableCreatorStep({ company, onStartOver }) {
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);
  const [generatedPrompts, setGeneratedPrompts] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState('select'); // select, generate, view

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

Create comprehensive, detailed, copy-paste ready prompts that a user can paste into any LLM to produce the selected deliverable.

The prompts should be:
1. Logically sequential (build on each other)
2. Highly detailed and specific
3. Ready to copy and paste
4. Tailored to the specific role and industry
5. Include all necessary context and requirements

Generate 3-5 prompts that walk through the complete creation process for this deliverable.

Return the data in JSON format with this structure:
{
  "deliverable_name": "${selectedDeliverable.name}",
  "overview": "Brief overview of what this deliverable is and why it's important",
  "prompts": [
    {
      "step": 1,
      "title": "Step Title",
      "description": "What this step accomplishes",
      "prompt": "The actual prompt to copy and paste into an LLM"
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
              items: {
                type: "object",
                properties: {
                  step: { type: "number" },
                  title: { type: "string" },
                  description: { type: "string" },
                  prompt: { type: "string" }
                }
              }
            }
          }
        }
      });

      setGeneratedPrompts(result);
      setStep('view');
    } catch (error) {
      console.error("Error generating prompts:", error);
    }
    
    setIsGenerating(false);
  };

  const resetSelection = () => {
    setSelectedDeliverable(null);
    setGeneratedPrompts(null);
    setStep('select');
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Button
              variant="outline"
              onClick={() => onStartOver(company)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
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
            Create Deliverable Prompts
          </h1>
          <p className="text-blue-200 max-w-2xl mx-auto">
            Select any deliverable from your matrices to generate detailed, copy-paste prompts for LLMs
          </p>
        </div>

        <AnimatePresence>
          {isGenerating && (
            <LoadingOverlay message="Generating comprehensive prompts for your deliverable..." />
          )}
        </AnimatePresence>

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
                  <Button variant="outline" onClick={resetSelection} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    Choose Different
                  </Button>
                  <Button onClick={generatePrompts} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6">
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Prompts
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
      </div>
    </div>
  );
}