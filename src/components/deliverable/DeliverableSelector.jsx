import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Target, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import NewDeliverableDialog from "./NewDeliverableDialog";

export default function DeliverableSelector({ productivityMatrix, performanceMatrix, onSelect }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMatrix, setSelectedMatrix] = useState("both");
  const [showNewDialog, setShowNewDialog] = useState(false);

  const handleNewDeliverable = (name, type) => {
    onSelect({
      name,
      type,
      column: 'Custom',
      isCustom: true,
    });
    setShowNewDialog(false);
  };

  const getAllDeliverables = () => {
    const deliverables = [];
    
    if (selectedMatrix === "both" || selectedMatrix === "productivity") {
      productivityMatrix?.columns?.forEach(column => {
        column.deliverables?.forEach(deliverable => {
          if (deliverable.toLowerCase().includes(searchTerm.toLowerCase())) {
            deliverables.push({
              name: deliverable,
              type: 'productivity',
              column: column.name
            });
          }
        });
      });
    }
    
    if (selectedMatrix === "both" || selectedMatrix === "performance") {
      performanceMatrix?.columns?.forEach(column => {
        column.problems?.forEach(problem => {
          if (problem.problem.toLowerCase().includes(searchTerm.toLowerCase())) {
            deliverables.push({
              name: problem.problem,
              type: 'performance',
              column: column.name,
              expert: problem.expert,
              strategy: problem.strategy
            });
          }
        });
      });
    }
    
    return deliverables;
  };

  const deliverables = getAllDeliverables();

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <Card className="bg-white/10 backdrop-blur-lg border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            Find Your Deliverable
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search deliverables or problems..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Button
                onClick={() => setShowNewDialog(true)}
                className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white whitespace-nowrap"
              >
                <Plus className="w-4 h-4 mr-2" />
                Custom Deliverable
              </Button>
              <div className="w-px h-6 bg-white/20 mx-1" />
              <Button
                variant={selectedMatrix === "both" ? "default" : "outline"}
                onClick={() => setSelectedMatrix("both")}
                className={selectedMatrix === "both" ? "bg-blue-600 hover:bg-blue-700" : "bg-white/10 border-white/20 text-white hover:bg-white/20"}
              >
                Both
              </Button>
              <Button
                variant={selectedMatrix === "productivity" ? "default" : "outline"}
                onClick={() => setSelectedMatrix("productivity")}
                className={selectedMatrix === "productivity" ? "bg-blue-600 hover:bg-blue-700" : "bg-white/10 border-white/20 text-white hover:bg-white/20"}
              >
                Productivity
              </Button>
              <Button
                variant={selectedMatrix === "performance" ? "default" : "outline"}
                onClick={() => setSelectedMatrix("performance")}
                className={selectedMatrix === "performance" ? "bg-purple-600 hover:bg-purple-700" : "bg-white/10 border-white/20 text-white hover:bg-white/20"}
              >
                Performance
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deliverables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deliverables.map((deliverable, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/20 transition-all duration-200 cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {deliverable.type === 'productivity' ? (
                    <FileText className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                  ) : (
                    <Target className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium mb-2 group-hover:text-blue-200 transition-colors">
                      {deliverable.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge className={`${deliverable.type === 'productivity' ? 'bg-blue-500' : 'bg-purple-500'} text-white text-xs`}>
                        {deliverable.type === 'productivity' ? 'Productivity' : 'Performance'}
                      </Badge>
                      <Badge variant="outline" className="bg-white/10 text-blue-200 border-white/20 text-xs">
                        {deliverable.column}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => onSelect(deliverable)}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                    >
                      Create Prompts
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {deliverables.length === 0 && (
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardContent className="p-8 text-center">
            <p className="text-blue-200">
              No deliverables found matching your search. Try adjusting your search terms or filter.
            </p>
          </CardContent>
        </Card>
      )}

      <NewDeliverableDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onSubmit={handleNewDeliverable}
      />
    </div>
  );
}