
import React, { useState, useEffect } from "react";
import { Company } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Edit3, Plus, Trash2, CheckCircle, ArrowRight, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sanitizeAndConformMatrix } from "../common/MatrixSanitizer";
import { useToast } from "@/components/ui/use-toast";

import MatrixDisplay from "../matrix/MatrixDisplay";
import EditableMatrix from "../matrix/EditableMatrix";
import LoadingOverlay from "../common/LoadingOverlay";

export default function MatrixBuilderStep({ company, knowledgeFileIds = [], onMatricesFinalized, onStartOver }) {
  const { toast } = useToast();
  const [currentCompany, setCurrentCompany] = useState(company);
  const [productivityMatrix, setProductivityMatrix] = useState(company?.productivity_matrix || null);
  const [performanceMatrix, setPerformanceMatrix] = useState(company?.performance_matrix || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingMatrix, setEditingMatrix] = useState(null);
  
  const step = (productivityMatrix && performanceMatrix) ? 'edit' : 'generate';

  const generateMatrices = async () => {
    if (!currentCompany) return;
    
    setIsGenerating(true);
    
    try {
      const productivityPrompt = `
Generate the deliverable matrix for this role. Use any company dossier or knowledge files in project knowledge as authoritative context.

Role: ${currentCompany.job_title}
Industry: ${currentCompany.industry}
Company Size: ${currentCompany.company_size}
${currentCompany.company_url ? `Company URL: ${currentCompany.company_url}` : ''}

PART A — 64 Standalone Deliverables (Productivity Matrix):
The JSON object must have a "title" and a "columns" array.
The title should be "First Draft of the Productivity Matrix".
The "columns" array should contain exactly 8 objects, where each object represents an area of responsibility and has a "name" (string) and a "deliverables" (array of 8 strings).
Each deliverable string must be a tangible output, ending with a format like "report", "plan", "document", etc.
Use [SYN] for any placeholder baseline data.
Ensure the 'deliverables' array is always present for each column.

Do NOT generate prompt chains for individual deliverables — those are generated on-click in a subsequent step.

Return ONLY the JSON object. Do not add any explanations or markdown formatting.
`;

      const productivitySchema = {
        type: "object",
        properties: {
          title: { type: "string" },
          columns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                deliverables: { type: "array", items: { type: "string" } }
              },
              required: ["name", "deliverables"]
            }
          }
        },
        required: ["title", "columns"]
      };

      const rawProductivityResult = await InvokeLLM({
        prompt: productivityPrompt,
        add_context_from_internet: !!currentCompany.company_url,
        company_url: currentCompany.company_url,
        response_json_schema: productivitySchema,
        // Additional knowledge files as context
        knowledgeFileIds,
        // Time study tracking
        operationType: 'productivity_matrix',
        operationName: `${currentCompany.job_title} - ${currentCompany.industry}`,
        companyId: currentCompany.id,
        // Dynamic baseline params
        industry: currentCompany.industry,
        companySize: currentCompany.company_size,
      });
      const conformedProductivityMatrix = sanitizeAndConformMatrix(rawProductivityResult, 'productivity');
      setProductivityMatrix(conformedProductivityMatrix);

      const performancePrompt = `
Generate the performance-metric deliverable matrix for this role. Use any company dossier or knowledge files in project knowledge as authoritative context.

Role: ${currentCompany.job_title}
Industry: ${currentCompany.industry}
Company Size: ${currentCompany.company_size}
${currentCompany.company_url ? `Company URL: ${currentCompany.company_url}` : ''}

PART B — 64 Performance-Metric Deliverables:
The JSON object must have a "title" and a "columns" array.
The title should be "Performance Matrix".
The "columns" array should contain exactly 8 objects. Each object represents a Key Performance Indicator (KPI) and must have a "name" (string for the KPI) and a "problems" array.
The "problems" array must contain exactly 8 objects. Each problem object must have three string properties: "problem" (starting with an actionable verb like Improve/Increase/Decrease/Optimize/Reduce), "expert", and "strategy".
Use [SYN] for placeholder baseline data.
Ensure the 'problems' array and all its nested properties are always present.

Do NOT generate prompt chains for individual deliverables — those are generated on-click in a subsequent step.

Return ONLY the JSON object. Do not add any explanations or markdown formatting.
`;

      const performanceSchema = {
        type: "object",
        properties: {
          title: { type: "string" },
          columns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                problems: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      problem: { type: "string" },
                      expert: { type: "string" },
                      strategy: { type: "string" }
                    },
                    required: ["problem", "expert", "strategy"]
                  }
                }
              },
              required: ["name", "problems"]
            }
          }
        },
        required: ["title", "columns"]
      };

      const rawPerformanceResult = await InvokeLLM({
        prompt: performancePrompt,
        add_context_from_internet: !!currentCompany.company_url,
        company_url: currentCompany.company_url,
        response_json_schema: performanceSchema,
        // Additional knowledge files as context
        knowledgeFileIds,
        // Time study tracking
        operationType: 'performance_matrix',
        operationName: `${currentCompany.job_title} - ${currentCompany.industry}`,
        companyId: currentCompany.id,
        // Dynamic baseline params
        industry: currentCompany.industry,
        companySize: currentCompany.company_size,
      });
      const conformedPerformanceMatrix = sanitizeAndConformMatrix(rawPerformanceResult, 'performance');
      setPerformanceMatrix(conformedPerformanceMatrix);

      const updatedCompanyData = {
        ...currentCompany,
        productivity_matrix: conformedProductivityMatrix,
        performance_matrix: conformedPerformanceMatrix
      };
      
      await Company.update(currentCompany.id, {
        productivity_matrix: conformedProductivityMatrix,
        performance_matrix: conformedPerformanceMatrix
      });
      setCurrentCompany(updatedCompanyData);

    } catch (error) {
      console.error("Error generating matrices:", error);
      toast({
        title: "Error",
        description: "Failed to generate matrices. Please try again.",
        variant: "destructive",
      });
    }
    
    setIsGenerating(false);
  };

  const handleMatrixUpdate = async (matrixType, updatedMatrix) => {
    try {
      const conformedMatrix = sanitizeAndConformMatrix(updatedMatrix, matrixType);
      const updatePayload = {};
      let updatedCompanyData = { ...currentCompany };

      if (matrixType === 'productivity') {
        setProductivityMatrix(conformedMatrix);
        updatePayload.productivity_matrix = conformedMatrix;
        updatedCompanyData.productivity_matrix = conformedMatrix;
      } else {
        setPerformanceMatrix(conformedMatrix);
        updatePayload.performance_matrix = conformedMatrix;
        updatedCompanyData.performance_matrix = conformedMatrix;
      }
      
      await Company.update(currentCompany.id, updatePayload);
      setCurrentCompany(updatedCompanyData);
      setEditingMatrix(null);
    } catch (error) {
      console.error("Error updating matrix:", error);
      toast({
        title: "Error",
        description: "Failed to update matrix. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // No changes needed below this line
  // ... rest of the component
  const finalizeMatrices = () => {
    onMatricesFinalized(currentCompany);
  };

  if (!currentCompany) {
    return <LoadingOverlay message="Loading session..." />;
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
            <Button
              variant="ghost"
              onClick={onStartOver}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20 mb-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Start Over with a New Role
            </Button>
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-lg rounded-full px-4 py-2 mb-4">
            <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              {currentCompany.job_title}
            </Badge>
            <span className="text-blue-200">•</span>
            <span className="text-blue-200">{currentCompany.industry}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Your Role Deliverables Matrices
          </h1>
          <p className="text-blue-200 max-w-2xl mx-auto">
            AI-generated productivity and performance frameworks tailored to your role
          </p>
        </div>

        <AnimatePresence>
          {isGenerating && (
            <LoadingOverlay message="Generating your personalized matrices..." />
          )}
        </AnimatePresence>

        {step === 'generate' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 w-full max-w-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-white flex items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6 text-blue-400" />
                  Ready to Generate
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                <p className="text-blue-200">
                  We'll create two comprehensive matrices for your role:
                </p>
                <div className="space-y-3">
                  <div className="bg-white/5 rounded-lg p-4">
                    <h4 className="font-semibold text-white mb-2">Productivity Matrix</h4>
                    <p className="text-sm text-blue-200">8 areas of responsibility with 8 deliverables each</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <h4 className="font-semibold text-white mb-2">Performance Matrix</h4>
                    <p className="text-sm text-blue-200">8 KPIs with expert strategies for improvement</p>
                  </div>
                </div>
                <Button onClick={generateMatrices} className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate My Matrices
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'edit' && productivityMatrix && performanceMatrix && (
          <div className="space-y-8">
            <div className="flex justify-center">
              <div className="flex gap-4">
                <Button variant="ghost" onClick={() => setEditingMatrix(editingMatrix === 'productivity' ? null : 'productivity')} className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Productivity Matrix
                </Button>
                <Button variant="ghost" onClick={() => setEditingMatrix(editingMatrix === 'performance' ? null : 'performance')} className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Performance Matrix
                </Button>
              </div>
            </div>

            {editingMatrix === 'productivity' ? (
              <EditableMatrix matrix={productivityMatrix} matrixType="productivity" onUpdate={(updatedMatrix) => handleMatrixUpdate('productivity', updatedMatrix)} onCancel={() => setEditingMatrix(null)} />
            ) : editingMatrix === 'performance' ? (
              <EditableMatrix matrix={performanceMatrix} matrixType="performance" onUpdate={(updatedMatrix) => handleMatrixUpdate('performance', updatedMatrix)} onCancel={() => setEditingMatrix(null)} />
            ) : (
              <div className="space-y-8">
                <MatrixDisplay matrix={productivityMatrix} type="productivity" />
                <MatrixDisplay matrix={performanceMatrix} type="performance" />
              </div>
            )}

            {!editingMatrix && (
              <div className="flex justify-center">
                <Button onClick={finalizeMatrices} className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-semibold py-3 px-8">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Finalize & Create Deliverables
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
