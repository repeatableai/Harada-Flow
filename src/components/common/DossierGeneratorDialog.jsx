/**
 * DossierGeneratorDialog
 *
 * A self-contained dialog that collects company info and generates
 * a dossier. Downloads as .docx and uploads as a knowledge file.
 * Can be used from any page — WelcomeStep, DeliverableCreatorStep, etc.
 */

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/api/apiClient';
import { Company } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import { downloadDocx } from '@/lib/downloadDocx';
import { Loader2, Search, Globe, Building, User, Briefcase } from 'lucide-react';

export default function DossierGeneratorDialog({ open, onOpenChange, companyId, onDossierGenerated }) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [fields, setFields] = useState({
    companyName: '',
    companyUrl: '',
    jobTitle: '',
    industry: '',
    companySize: '',
  });

  const isValid = fields.jobTitle.trim() && fields.industry.trim() && fields.companySize;

  const handleChange = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async () => {
    if (!isValid) return;
    setIsGenerating(true);

    try {
      // If no companyId provided, create a temporary company record
      let activeCompanyId = companyId;
      if (!activeCompanyId) {
        const newCompany = await Company.create({
          job_title: fields.jobTitle,
          industry: fields.industry,
          company_size: fields.companySize,
          company_url: fields.companyUrl || '',
        });
        activeCompanyId = newCompany.id;
      }

      // Fire dossier generation via SSE
      const result = await apiClient.requestSSE('/dossier/generate', {
        method: 'POST',
        body: JSON.stringify({
          companyName: fields.companyName || fields.industry || 'the company',
          companyUrl: fields.companyUrl || null,
          jobTitle: fields.jobTitle || null,
          industry: fields.industry || null,
          companySize: fields.companySize || null,
          engagementFocus: fields.jobTitle || 'operational deliverables',
          companyId: activeCompanyId,
        }),
      });

      const dossierContent = result.content || '';

      // Download as .docx
      if (dossierContent) {
        const filename = `Company-Dossier-${(fields.companyName || fields.industry || 'Dossier').replace(/[^a-zA-Z0-9]/g, '-')}`;
        downloadDocx(dossierContent, filename).catch(err => {
          console.error('Failed to download dossier as docx:', err);
        });
      }

      // Upload as knowledge file
      let dossierFileId = null;
      if (dossierContent) {
        try {
          const dossierFile = new File(
            [dossierContent],
            `Company-Dossier-${activeCompanyId}.md`,
            { type: 'text/markdown' }
          );
          const uploadResult = await apiClient.knowledgeFiles.upload(
            dossierFile,
            'self',
            [],
            'Auto-generated company dossier',
          );
          dossierFileId = uploadResult.id;
        } catch (uploadErr) {
          console.error('Failed to upload dossier as knowledge file:', uploadErr);
        }
      }

      toast({
        title: 'Dossier Generated',
        description: 'Downloaded as .docx and added to your knowledge files.',
        duration: 5000,
      });

      onOpenChange(false);

      if (onDossierGenerated) {
        onDossierGenerated({
          content: dossierContent,
          companyId: activeCompanyId,
          knowledgeFileId: dossierFileId,
        });
      }
    } catch (err) {
      toast({
        title: 'Dossier generation failed',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-slate-900 border-white/20 max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-cyan-400" />
            Generate Company Dossier
          </AlertDialogTitle>
          <AlertDialogDescription className="text-blue-200/70">
            We'll research the company using web search and generate a comprehensive dossier. It will be downloaded as a .docx and added to your knowledge files.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="dossier-company" className="text-white text-sm flex items-center gap-1 mb-1">
              <Building className="w-3 h-3" /> Company Name
            </Label>
            <Input
              id="dossier-company"
              placeholder="e.g., Acme Corp"
              value={fields.companyName}
              onChange={e => handleChange('companyName', e.target.value)}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>

          <div>
            <Label htmlFor="dossier-url" className="text-white text-sm flex items-center gap-1 mb-1">
              <Globe className="w-3 h-3" /> Company Website
            </Label>
            <Input
              id="dossier-url"
              placeholder="https://company.com"
              value={fields.companyUrl}
              onChange={e => handleChange('companyUrl', e.target.value)}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>

          <div>
            <Label htmlFor="dossier-role" className="text-white text-sm flex items-center gap-1 mb-1">
              <User className="w-3 h-3" /> Job Title <span className="text-red-400">*</span>
            </Label>
            <Input
              id="dossier-role"
              placeholder="e.g., COO"
              value={fields.jobTitle}
              onChange={e => handleChange('jobTitle', e.target.value)}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>

          <div>
            <Label htmlFor="dossier-industry" className="text-white text-sm flex items-center gap-1 mb-1">
              <Briefcase className="w-3 h-3" /> Industry <span className="text-red-400">*</span>
            </Label>
            <Input
              id="dossier-industry"
              placeholder="e.g., Manufacturing"
              value={fields.industry}
              onChange={e => handleChange('industry', e.target.value)}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>

          <div>
            <Label className="text-white text-sm flex items-center gap-1 mb-1">
              <Building className="w-3 h-3" /> Company Size <span className="text-red-400">*</span>
            </Label>
            <Select value={fields.companySize} onValueChange={v => handleChange('companySize', v)}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Select company size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="startup">Startup (1-10)</SelectItem>
                <SelectItem value="small">Small (11-50)</SelectItem>
                <SelectItem value="medium">Medium (51-200)</SelectItem>
                <SelectItem value="large">Large (201-1000)</SelectItem>
                <SelectItem value="enterprise">Enterprise (1000+)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="text-white border-white/20" disabled={isGenerating}>
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={handleGenerate}
            disabled={!isValid || isGenerating}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating Dossier...</>
            ) : (
              <><Search className="w-4 h-4 mr-2" /> Generate Dossier</>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
