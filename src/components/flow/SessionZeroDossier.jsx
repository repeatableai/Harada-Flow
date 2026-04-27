/**
 * Session 00 — Dossier Pre-Check
 *
 * Every new engagement starts here. The user either:
 * 1. Uploads existing company knowledge files (→ dossierStatus = 'uploaded')
 * 2. Asks the DCE to generate a dossier (→ dossierStatus = 'generated')
 *
 * On re-open, if dossierStatus !== 'pending', this step is skipped.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/api/apiClient';
import { useToast } from '@/components/ui/use-toast';
import {
  FileUp,
  Sparkles,
  Loader2,
  FileText,
  CheckCircle,
  ArrowRight,
  Upload,
  X,
} from 'lucide-react';

export default function SessionZeroDossier({ company, onComplete }) {
  const { toast } = useToast();
  const [path, setPath] = useState(null); // null | 'upload' | 'generate'
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [companyName, setCompanyName] = useState(company?.jobTitle ? '' : '');
  const [engagementFocus, setEngagementFocus] = useState('');
  const [dossierContent, setDossierContent] = useState(null);
  const [error, setError] = useState('');

  const ALLOWED_TYPES = [
    'text/markdown', 'text/plain', 'text/csv',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];

  // ── Upload Path ──────────────────────────────────────────

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    setError('');

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({
          title: 'File type not allowed',
          description: `${file.name} is not a supported format.`,
          variant: 'destructive',
        });
        continue;
      }

      try {
        const result = await apiClient.knowledgeFiles.upload(
          file, 'self', [], `Dossier context file for engagement`, null
        );
        setUploadedFiles(prev => [...prev, { id: result.id, name: file.name }]);
      } catch (err) {
        toast({
          title: 'Upload failed',
          description: err.message || `Failed to upload ${file.name}`,
          variant: 'destructive',
        });
      }
    }

    setIsUploading(false);
    e.target.value = '';
  };

  const handleUploadComplete = async () => {
    if (uploadedFiles.length === 0) {
      setError('Please upload at least one file.');
      return;
    }

    try {
      // Update dossier status to 'uploaded'
      await apiClient.request(`/dossier/${company.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          dossierStatus: 'uploaded',
          dossierFilename: uploadedFiles.map(f => f.name).join(', '),
        }),
      });
      onComplete('uploaded');
    } catch (err) {
      setError(err.message || 'Failed to update dossier status');
    }
  };

  // ── Generate Path ────────────────────────────────────────

  const handleGenerate = async () => {
    if (!companyName.trim()) {
      setError('Company name is required.');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const result = await apiClient.requestSSE('/dossier/generate', {
        method: 'POST',
        body: JSON.stringify({
          companyName: companyName.trim(),
          engagementFocus: engagementFocus.trim() || null,
          companyId: company.id,
        }),
      });

      setDossierContent(result.content);
      toast({
        title: 'Dossier Generated',
        description: `${result.filename} has been created and stored.`,
        duration: 5000,
      });

      // Brief delay so user sees the success state
      setTimeout(() => onComplete('generated'), 1500);
    } catch (err) {
      setError(err.message || 'Dossier generation failed');
      setIsGenerating(false);
    }
  };

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-300 text-xs mb-4">
          <FileText className="w-3 h-3" />
          Session 00 — Dossier Pre-Check
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Company Knowledge Foundation
        </h2>
        <p className="text-blue-200/70 text-sm max-w-lg mx-auto">
          Do you have an existing company dossier or knowledge files sufficient
          to inform deliverables for this engagement, or would you like the DCE
          to generate a dossier first?
        </p>
      </div>

      {/* Path Selection */}
      {!path && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card
            className="bg-white/5 border-white/10 hover:border-green-500/50 hover:bg-white/10 cursor-pointer transition-all"
            onClick={() => setPath('upload')}
          >
            <CardContent className="p-6 text-center">
              <FileUp className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">I Have Files</h3>
              <p className="text-blue-200/60 text-xs">
                Upload existing dossier, research, or context files
              </p>
            </CardContent>
          </Card>

          <Card
            className="bg-white/5 border-white/10 hover:border-purple-500/50 hover:bg-white/10 cursor-pointer transition-all"
            onClick={() => setPath('generate')}
          >
            <CardContent className="p-6 text-center">
              <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Generate Dossier</h3>
              <p className="text-blue-200/60 text-xs">
                DCE researches the company and builds a 22-section dossier
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Path */}
      {path === 'upload' && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FileUp className="w-4 h-4 text-green-400" />
                Upload Knowledge Files
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setPath(null); setUploadedFiles([]); }}
                className="text-blue-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-blue-200/60 text-xs">
              Accepted formats: .md, .docx, .xlsx, .pdf, .pptx, .csv, .txt
            </p>

            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-green-500/50 hover:bg-white/5 transition-all">
              <Upload className="w-8 h-8 text-blue-300 mb-2" />
              <span className="text-blue-200/70 text-sm">
                {isUploading ? 'Uploading...' : 'Click or drag files here'}
              </span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-white text-xs">{f.name}</span>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleUploadComplete}
              disabled={uploadedFiles.length === 0 || isUploading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              Continue to Matrix
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generate Path */}
      {path === 'generate' && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Generate Company Dossier
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPath(null)}
                className="text-blue-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-blue-200/60 text-xs">
              The DCE will research the company using web search and produce a comprehensive
              22-section dossier. This typically takes 3-5 minutes.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-blue-200 text-sm">Company Name *</Label>
                <Input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g., Momentum Manufacturing Group"
                  className="bg-white/10 border-white/20 text-white"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <Label className="text-blue-200 text-sm">Engagement Focus (optional)</Label>
                <Textarea
                  value={engagementFocus}
                  onChange={e => setEngagementFocus(e.target.value)}
                  placeholder="e.g., Technology Division operational transformation, AI integration roadmap"
                  className="bg-white/10 border-white/20 text-white min-h-[80px]"
                  disabled={isGenerating}
                />
              </div>
            </div>

            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-purple-300 text-sm font-medium">Generating dossier...</p>
                <p className="text-blue-200/50 text-xs">
                  Researching company data across 6 tiers. This may take 3-5 minutes.
                </p>
              </div>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={!companyName.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Dossier
              </Button>
            )}

            {dossierContent && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded">
                <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Dossier generated successfully
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
