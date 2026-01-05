
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Target, User, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

export default function MatrixDisplay({ matrix, type }) {
  if (!matrix) return null;

  const isProductivity = type === 'productivity';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl">
        <CardHeader className="pb-6">
          <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
            {isProductivity ? (
              <FileText className="w-7 h-7 text-blue-400" />
            ) : (
              <Target className="w-7 h-7 text-purple-400" />
            )}
            {matrix.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`${isProductivity ? 'bg-blue-500' : 'bg-purple-500'} text-white`}>
              {isProductivity ? 'Productivity' : 'Performance'}
            </Badge>
            <span className="text-blue-200">•</span>
            <span className="text-blue-200">{(matrix.columns || []).length} Areas</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/20 hover:bg-white/5">
                  {(matrix.columns || []).map((column, index) => (
                    <TableHead key={index} className="text-white font-semibold text-center min-w-[200px] p-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isProductivity ? 'bg-blue-400' : 'bg-purple-400'}`} />
                        {column.name}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }, (_, rowIndex) => (
                  <TableRow key={rowIndex} className="border-white/10 hover:bg-white/5 transition-colors">
                    {(matrix.columns || []).map((column, colIndex) => (
                      <TableCell key={colIndex} className="p-4 align-top">
                        {isProductivity ? (
                          <div className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                            <p className="text-blue-100 font-medium">
                              {(column.deliverables || [])[rowIndex] || ''}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors space-y-2">
                            <p className="text-purple-100 font-medium text-sm">
                              {((column.problems || [])[rowIndex] || {}).problem || ''}
                            </p>
                            {(column.problems || [])[rowIndex]?.expert && (
                              <div className="flex items-center gap-2 text-xs">
                                <User className="w-3 h-3 text-blue-400" />
                                <span className="text-blue-200">
                                  {(column.problems || [])[rowIndex].expert}
                                </span>
                              </div>
                            )}
                            {(column.problems || [])[rowIndex]?.strategy && (
                              <div className="flex items-start gap-2 text-xs">
                                <Lightbulb className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-300">
                                  {(column.problems || [])[rowIndex].strategy}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
