
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { InvokeLLM } from "@/api/integrations";
import { Edit3, Plus, Trash2, Save, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function EditableMatrix({ matrix, matrixType, onUpdate, onCancel }) {
  const [editedMatrix, setEditedMatrix] = useState(JSON.parse(JSON.stringify(matrix || {})));
  const [isGenerating, setIsGenerating] = useState(false);

  const isProductivity = matrixType === 'productivity';

  const handleColumnNameChange = (columnIndex, newName) => {
    const updated = { ...editedMatrix };
    updated.columns[columnIndex].name = newName;
    setEditedMatrix(updated);
  };

  const handleDeliverableChange = (columnIndex, deliverableIndex, newValue) => {
    const updated = { ...editedMatrix };
    if (isProductivity) {
      updated.columns[columnIndex].deliverables[deliverableIndex] = newValue;
    } else {
      updated.columns[columnIndex].problems[deliverableIndex].problem = newValue;
    }
    setEditedMatrix(updated);
  };

  const addDeliverable = (columnIndex) => {
    const updated = { ...editedMatrix };
    if (isProductivity) {
      if (!updated.columns[columnIndex].deliverables) {
        updated.columns[columnIndex].deliverables = [];
      }
      updated.columns[columnIndex].deliverables.push('');
    } else {
      if (!updated.columns[columnIndex].problems) {
        updated.columns[columnIndex].problems = [];
      }
      updated.columns[columnIndex].problems.push({
        problem: '',
        expert: '',
        strategy: ''
      });
    }
    setEditedMatrix(updated);
  };

  const removeDeliverable = (columnIndex, deliverableIndex) => {
    const updated = { ...editedMatrix };
    if (isProductivity) {
      updated.columns[columnIndex].deliverables.splice(deliverableIndex, 1);
    } else {
      updated.columns[columnIndex].problems.splice(deliverableIndex, 1);
    }
    setEditedMatrix(updated);
  };

  const removeColumn = (columnIndex) => {
    const updated = { ...editedMatrix };
    updated.columns.splice(columnIndex, 1);
    setEditedMatrix(updated);
  };

  const addColumn = async () => {
    const columnName = prompt('Enter the name of the new area of responsibility:');
    if (!columnName) return;

    setIsGenerating(true);
    
    try {
      const prompt = `Generate 8 ${isProductivity ? 'deliverables' : 'problems with expert solutions'} for the area of responsibility: "${columnName}" in the context of a ${matrixType} matrix. 
      
      ${isProductivity ? 
        'Each deliverable should be a tangible output that ends with a format like "report", "plan", "document", etc.' :
        'Each problem should start with actionable verbs and include an expert name and strategy.'
      }
      
      Return as JSON array.`;

      const result = await InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: isProductivity ? 
                { type: "string" } :
                {
                  type: "object",
                  properties: {
                    problem: { type: "string" },
                    expert: { type: "string" },
                    strategy: { type: "string" }
                  }
                }
            }
          }
        }
      });

      const updated = { ...editedMatrix };
      if (!updated.columns) {
          updated.columns = [];
      }
      updated.columns.push({
        name: columnName,
        [isProductivity ? 'deliverables' : 'problems']: result.items || []
      });
      setEditedMatrix(updated);
    } catch (error) {
      console.error("Error generating column:", error);
    }
    
    setIsGenerating(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl">
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
              <Edit3 className="w-7 h-7 text-blue-400" />
              Edit {matrix.title}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onCancel}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={() => onUpdate(editedMatrix)}
                className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${isProductivity ? 'bg-blue-500' : 'bg-purple-500'} text-white`}>
              {isProductivity ? 'Productivity' : 'Performance'}
            </Badge>
            <Button
              onClick={addColumn}
              disabled={isGenerating}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-sm"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Column
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {(editedMatrix.columns || []).map((column, columnIndex) => (
                <div key={columnIndex} className="bg-white/5 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Input
                      value={column.name}
                      onChange={(e) => handleColumnNameChange(columnIndex, e.target.value)}
                      className="bg-white/10 border-white/20 text-white font-semibold"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeColumn(columnIndex)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {((isProductivity ? column.deliverables : column.problems) || []).map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-center gap-2">
                        <Input
                          value={isProductivity ? item : item.problem}
                          onChange={(e) => handleDeliverableChange(columnIndex, itemIndex, e.target.value)}
                          className="bg-white/10 border-white/20 text-white text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDeliverable(columnIndex, itemIndex)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    
                    <Button
                      variant="ghost"
                      onClick={() => addDeliverable(columnIndex)}
                      className="w-full bg-white/5 hover:bg-white/10 text-blue-300 border-dashed border border-white/20"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add {isProductivity ? 'Deliverable' : 'Problem'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
