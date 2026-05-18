import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Company, User as UserApi } from "@/api/entities";
import { apiClient } from "@/api/apiClient";
import { Sparkles, Building, User, Globe, ArrowRight, Info, FolderOpen, Plus, Bookmark, FileUp, Edit3, Loader2, FileText, ToggleLeft, ToggleRight, ShieldCheck, ShieldAlert, ShieldX, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import FileUploadArea from "@/components/common/FileUploadArea";
import { downloadDocx } from "@/lib/downloadDocx";
import SessionsList from "@/components/dashboard/SessionsList";
import SavedPromptsList from "@/components/dashboard/SavedPromptsList";

export default function WelcomeStep({ onCompanyCreated, onLoadSession, onDeleteSession, hasExistingSessions = false }) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(hasExistingSessions ? 'sessions' : 'new');
  const [inputMode, setInputMode] = useState('form'); // 'form' | 'upload' - inline toggle
  const [formData, setFormData] = useState({
    job_title: "",
    industry: "",
    company_size: "",
    company_url: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isPreFilled, setIsPreFilled] = useState(false);
  const [isExtractingRole, setIsExtractingRole] = useState(false);

  // Dossier generation state
  const [isGeneratingDossier, setIsGeneratingDossier] = useState(false);
  const [dossierGenerated, setDossierGenerated] = useState(false);

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  // Organization knowledge files state (company-wide files from admins)
  const [orgKnowledgeFiles, setOrgKnowledgeFiles] = useState([]);
  const [selectedOrgFileIds, setSelectedOrgFileIds] = useState(new Set());
  const [isLoadingOrgFiles, setIsLoadingOrgFiles] = useState(false);

  useEffect(() => {
    // Pre-fill form from user profile and organization data
    if (currentUser) {
      const org = currentUser.organization;
      const updates = {};
      let hasOrgData = false;

      // Pre-fill job title from user profile
      if (currentUser.jobTitle || currentUser.job_title) {
        updates.job_title = currentUser.jobTitle || currentUser.job_title;
      }

      // Pre-fill from organization data if available
      if (org?.industry) {
        updates.industry = org.industry;
        hasOrgData = true;
      }
      if (org?.companySize) {
        updates.company_size = org.companySize;
        hasOrgData = true;
      }
      if (org?.website) {
        updates.company_url = org.website;
        hasOrgData = true;
      }

      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({ ...prev, ...updates }));
      }
      setIsPreFilled(hasOrgData);
    }
  }, [currentUser]);

  // Fetch organization knowledge files on mount
  useEffect(() => {
    const fetchOrgFiles = async () => {
      setIsLoadingOrgFiles(true);
      try {
        const files = await apiClient.knowledgeFiles.getAvailableContext();
        setOrgKnowledgeFiles(files || []);
        // Auto-select all org files by default
        if (files && files.length > 0) {
          setSelectedOrgFileIds(new Set(files.map(f => f.id)));
        }
      } catch (error) {
        console.error('Failed to fetch organization knowledge files:', error);
      }
      setIsLoadingOrgFiles(false);
    };

    if (currentUser) {
      fetchOrgFiles();
    }
  }, [currentUser]);

  // Toggle organization knowledge file selection
  const toggleOrgFile = (fileId) => {
    setSelectedOrgFileIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const selectAllOrgFiles = () => {
    setSelectedOrgFileIds(new Set(orgKnowledgeFiles.map(f => f.id)));
  };

  const deselectAllOrgFiles = () => {
    setSelectedOrgFileIds(new Set());
  };

  const allOrgFilesSelected = orgKnowledgeFiles.length > 0 && selectedOrgFileIds.size === orgKnowledgeFiles.length;

  // Handle file selection and upload
  const handleFilesSelected = async (files) => {
    setIsUploadingFiles(true);
    const uploaded = [];

    for (const file of files) {
      try {
        const result = await apiClient.knowledgeFiles.upload(
          file,
          'self', // Always personal scope for role context files
          [],     // No departments
          `Context file for ${formData.job_title || 'my role'}`,
          null    // No organization override
        );

        // CUI sniffer: WARN — flagged
        if (result.cuiWarning) {
          toast({
            title: "Upload Rejected",
            description: `Your file was not uploaded. There is a possibility that it violates CUI compliance regulations. Please contact your IT executive or manager to determine acceptance criteria.`,
            variant: "destructive",
            duration: 10000,
          });
          continue;
        }

        // CUI sniffer: PASS
        uploaded.push(result);
      } catch (error) {
        if (error.cuiBlocked) {
          toast({
            title: "Upload Rejected",
            description: `Your file was not uploaded. There is a possibility that it violates CUI compliance regulations. Please contact your IT executive or manager to determine acceptance criteria.`,
            variant: "destructive",
            duration: 10000,
          });
        } else {
          toast({
            title: "Upload Failed",
            description: `"${file.name}" could not be uploaded: ${error.message}`,
            variant: "destructive",
            duration: 5000,
          });
        }
      }
    }

    setUploadedFiles(prev => [...prev, ...uploaded]);
    setIsUploadingFiles(false);
  };

  // Handle file removal
  const handleRemoveFile = async (fileId) => {
    try {
      await apiClient.knowledgeFiles.delete(fileId);
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  // Handle mode switching - clear the other mode's data to ensure only one method is used
  const handleModeSwitch = async (newMode) => {
    if (newMode === inputMode) return;

    if (newMode === 'form') {
      // Switching to form mode - delete any uploaded files
      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          try {
            await apiClient.knowledgeFiles.delete(file.id);
          } catch (error) {
            console.error('Failed to delete file during mode switch:', error);
          }
        }
        setUploadedFiles([]);
        toast({
          title: "Switched to manual entry",
          description: "Your uploaded files have been removed. Please fill in your role details.",
        });
      }
    } else if (newMode === 'upload') {
      // Switching to upload mode - clear form data
      const hadFormData = formData.job_title || formData.industry || formData.company_size;
      setFormData({
        job_title: "",
        industry: "",
        company_size: "",
        company_url: ""
      });
      setIsPreFilled(false);
      if (hadFormData) {
        toast({
          title: "Switched to document upload",
          description: "Your form data has been cleared. Upload documents to extract your role details.",
        });
      }
    }

    setInputMode(newMode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create the company session record with form data
      const newCompany = await Company.create(formData);

      // Update the user's profile with the new job title non-blockingly
      UserApi.updateMe({ job_title: formData.job_title }).catch(err => {
        console.error("Failed to update user profile:", err);
      });

      // Pass company and selected org knowledge file IDs for matrix generation
      onCompanyCreated(newCompany, Array.from(selectedOrgFileIds));
    } catch (error) {
      console.error("Error saving company data:", error);
    }

    setIsSubmitting(false);
  };

  const handleGenerateDossier = async () => {
    if (!isFormValid) {
      toast({ title: 'Fill in required fields first', description: 'Job Title, Industry, and Company Size are needed to generate a dossier.', variant: 'destructive' });
      return;
    }

    setIsGeneratingDossier(true);

    try {
      // Create a company record first
      const newCompany = await Company.create(formData);

      // Fire dossier generation via SSE
      const result = await apiClient.requestSSE('/dossier/generate', {
        method: 'POST',
        body: JSON.stringify({
          companyName: formData.industry || 'the company',
          companyUrl: formData.company_url || null,
          jobTitle: formData.job_title || null,
          industry: formData.industry || null,
          companySize: formData.company_size || null,
          engagementFocus: formData.job_title || 'operational deliverables',
          companyId: newCompany.id,
        }),
      });

      const dossierContent = result.content || '';

      // Download dossier as .docx to user's system
      if (dossierContent) {
        const dossierFilename = `Company-Dossier-${(formData.industry || 'Dossier').replace(/[^a-zA-Z0-9]/g, '-')}`;
        downloadDocx(dossierContent, dossierFilename).catch(err => {
          console.error('Failed to download dossier as docx:', err);
        });
      }

      // Upload dossier as a knowledge file so it's included in matrix generation
      let dossierFileId = null;
      if (dossierContent) {
        try {
          const dossierFile = new File(
            [dossierContent],
            `Company-Dossier-${newCompany.id}.md`,
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

      setDossierGenerated(true);
      toast({ title: 'Dossier Generated', description: 'Company dossier downloaded and added to your knowledge files for matrix generation.', duration: 5000 });

      // Also update user profile
      UserApi.updateMe({ job_title: formData.job_title }).catch(() => {});

      // Include dossier file ID alongside any selected org files for matrix generation
      const allFileIds = Array.from(selectedOrgFileIds);
      if (dossierFileId) allFileIds.push(dossierFileId);

      // Proceed to matrix generation with dossier already created and included as context
      onCompanyCreated(newCompany, allFileIds);
    } catch (err) {
      toast({ title: 'Dossier generation failed', description: err.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsGeneratingDossier(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isFormValid = formData.job_title && formData.industry && formData.company_size;
  const isUploadValid = uploadedFiles.length > 0;

  // Handle upload-only submission with role extraction
  const handleUploadOnlySubmit = async () => {
    if (uploadedFiles.length === 0) return;

    setIsExtractingRole(true);
    setIsSubmitting(true);

    try {
      // Call LLM to extract role information from uploaded files
      const fileIds = uploadedFiles.map(f => f.id);
      const extractionResult = await apiClient.integrations.extractRoleFromFiles(fileIds);

      if (!extractionResult || !extractionResult.job_title) {
        throw new Error('Failed to extract role information from files');
      }

      // Create the company session with extracted data
      const newCompany = await Company.create({
        job_title: extractionResult.job_title,
        industry: extractionResult.industry || 'General',
        company_size: extractionResult.company_size || 'medium',
        company_url: extractionResult.company_url || null
      });

      // Link uploaded files to the new company
      await Promise.all(
        uploadedFiles.map(file =>
          apiClient.knowledgeFiles.linkToCompany(file.id, newCompany.id).catch(err => {
            console.error('Failed to link file to company:', file.originalName, err);
          })
        )
      );

      // Update user profile with job title
      UserApi.updateMe({ job_title: extractionResult.job_title }).catch(err => {
        console.error("Failed to update user profile:", err);
      });

      toast({
        title: "Role extracted successfully",
        description: `Detected: ${extractionResult.job_title} in ${extractionResult.industry}`,
      });

      // Pass company and selected org knowledge file IDs for matrix generation
      onCompanyCreated(newCompany, Array.from(selectedOrgFileIds));
    } catch (error) {
      console.error("Error extracting role from files:", error);
      toast({
        title: "Extraction failed",
        description: "Could not extract role information. Please try the form instead.",
        variant: "destructive",
      });
    }

    setIsExtractingRole(false);
    setIsSubmitting(false);
  };

  const renderNewRoleForm = () => (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mb-6">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Build Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Role Deliverables Matrices</span>
        </h1>
        <p className="text-xl text-blue-200 max-w-2xl mx-auto leading-relaxed">
          Transform your role into a productivity powerhouse with AI-generated matrices that define your deliverables and performance metrics.
        </p>

        {/* Subtle Repeatable AI branding */}
        <div className="flex items-center justify-center space-x-2 mt-6 opacity-60">
          <span className="text-sm text-blue-300">Powered by</span>
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/199aedeea_FinalRepeatableLogowithoutbackground1.png"
            alt="Repeatable AI"
            className="h-6 w-auto"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                  <Building className="w-6 h-6 text-blue-400" />
                  Tell us about your role
                </CardTitle>
                <p className="text-blue-200 mt-1">
                  We'll use this information to create personalized matrices for your specific position and industry.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleGenerateDossier}
                disabled={!isFormValid || isGeneratingDossier || isSubmitting}
                className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs px-3 py-2 flex-shrink-0"
              >
                {isGeneratingDossier ? (
                  <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Generating...</>
                ) : (
                  <><Search className="w-3 h-3 mr-1" /> Generate Dossier</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Inline Mode Toggle */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-blue-200">How would you like to define your role?</span>
                <span className="text-xs text-blue-300/70 italic">Choose one method</span>
              </div>
              <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('form')}
                  disabled={isUploadingFiles || isSubmitting}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                    inputMode === 'form'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                      : 'text-blue-300 hover:text-white hover:bg-white/10'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Edit3 className="w-4 h-4" />
                  Fill in Details
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('upload')}
                  disabled={isUploadingFiles || isSubmitting}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                    inputMode === 'upload'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                      : 'text-blue-300 hover:text-white hover:bg-white/10'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <FileUp className="w-4 h-4" />
                  Upload Documents
                </button>
              </div>
            </div>

            {/* Form Mode Content */}
            {inputMode === 'form' && (
              <>
                {isPreFilled && (
                  <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <p className="text-blue-200 text-sm">
                      Your company information has been pre-filled. Feel free to review and adjust as needed.
                    </p>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="job_title" className="text-white font-medium flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-400" />
                        Job Title
                      </Label>
                      <Input
                        id="job_title"
                        value={formData.job_title}
                        onChange={(e) => handleInputChange("job_title", e.target.value)}
                        placeholder={isLoadingUser ? "Loading profile..." : "e.g., Corporate Controller, Marketing Director"}
                        className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20 transition-all duration-200"
                        required
                        disabled={isLoadingUser}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="industry" className="text-white font-medium flex items-center gap-2">
                        <Building className="w-4 h-4 text-blue-400" />
                        Industry
                      </Label>
                      <Input
                        id="industry"
                        value={formData.industry}
                        onChange={(e) => handleInputChange("industry", e.target.value)}
                        placeholder="e.g., Technology, Healthcare, Finance"
                        className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20 transition-all duration-200"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="company_size" className="text-white font-medium">
                        Company Size
                      </Label>
                      <Select value={formData.company_size} onValueChange={(value) => handleInputChange("company_size", value)}>
                        <SelectTrigger className="bg-white/10 border-white/20 text-white">
                          <SelectValue placeholder="Select company size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="startup">Startup (1-10 employees)</SelectItem>
                          <SelectItem value="small">Small (11-50 employees)</SelectItem>
                          <SelectItem value="medium">Medium (51-200 employees)</SelectItem>
                          <SelectItem value="large">Large (201-1000 employees)</SelectItem>
                          <SelectItem value="enterprise">Enterprise (1000+ employees)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="company_url" className="text-white font-medium flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-400" />
                        Company Website
                      </Label>
                      <Input
                        id="company_url"
                        value={formData.company_url}
                        onChange={(e) => handleInputChange("company_url", e.target.value)}
                        placeholder="https://company.com"
                        className="bg-white/10 border-white/20 text-white placeholder-blue-300 focus:bg-white/20 transition-all duration-200"
                      />
                    </div>
                  </div>

                  {/* Organization Knowledge Files Section */}
                  {orgKnowledgeFiles.length > 0 && (
                    <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-green-400" />
                          <span className="text-white text-sm font-medium">Organization Knowledge</span>
                          <span className="text-xs text-blue-300/70">({selectedOrgFileIds.size} of {orgKnowledgeFiles.length} selected)</span>
                        </div>
                        <button
                          type="button"
                          onClick={allOrgFilesSelected ? deselectAllOrgFiles : selectAllOrgFiles}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {allOrgFilesSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      <p className="text-blue-200/70 text-xs mb-3">
                        These company-wide files will be used to enhance your matrix generation with organizational context.
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {orgKnowledgeFiles.map(file => (
                          <div key={file.id} className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FileText className="w-3 h-3 text-blue-400 flex-shrink-0" />
                              <span className="text-white text-xs truncate">{file.originalName}</span>
                              <span className="text-blue-300/50 text-xs flex-shrink-0">({file.scope})</span>
                            </div>
                            <Switch
                              checked={selectedOrgFileIds.has(file.id)}
                              onCheckedChange={() => toggleOrgFile(file.id)}
                              className="ml-2"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-6">
                    <Button
                      type="submit"
                      disabled={!isFormValid || isSubmitting || isLoadingUser}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                          Creating Your Matrices...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Sparkles className="w-5 h-5" />
                          Generate My Matrices
                          <ArrowRight className="w-5 h-5" />
                        </div>
                      )}
                    </Button>
                  </div>
                </form>
              </>
            )}

            {/* Upload Mode Content */}
            {inputMode === 'upload' && (
              <div className="space-y-6">
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <p className="text-purple-200 text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 flex-shrink-0" />
                    Upload job descriptions, org charts, or role documents. Our AI will extract your role details automatically.
                  </p>
                </div>

                <FileUploadArea
                  files={uploadedFiles}
                  onFilesSelected={handleFilesSelected}
                  onRemoveFile={handleRemoveFile}
                  isUploading={isUploadingFiles}
                  maxFiles={10}
                  disabled={isSubmitting}
                />

                {/* Organization Knowledge Files Section */}
                {orgKnowledgeFiles.length > 0 && (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-400" />
                        <span className="text-white text-sm font-medium">Organization Knowledge</span>
                        <span className="text-xs text-blue-300/70">({selectedOrgFileIds.size} of {orgKnowledgeFiles.length} selected)</span>
                      </div>
                      <button
                        type="button"
                        onClick={allOrgFilesSelected ? deselectAllOrgFiles : selectAllOrgFiles}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {allOrgFilesSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <p className="text-blue-200/70 text-xs mb-3">
                      These company-wide files will be used to enhance your matrix generation with organizational context.
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {orgKnowledgeFiles.map(file => (
                        <div key={file.id} className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileText className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="text-white text-xs truncate">{file.originalName}</span>
                            <span className="text-blue-300/50 text-xs flex-shrink-0">({file.scope})</span>
                          </div>
                          <Switch
                            checked={selectedOrgFileIds.has(file.id)}
                            onCheckedChange={() => toggleOrgFile(file.id)}
                            className="ml-2"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <Button
                    type="button"
                    onClick={handleUploadOnlySubmit}
                    disabled={!isUploadValid || isSubmitting}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isExtractingRole ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing Documents...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        Extract Role & Generate Matrices
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-128px)] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-white/10 border border-white/20">
              <TabsTrigger
                value="new"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-gray-300"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Role
              </TabsTrigger>
              <TabsTrigger
                value="sessions"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-gray-300"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Roles
              </TabsTrigger>
              <TabsTrigger
                value="prompts"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-gray-300"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Requests
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="new" className="mt-0">
            {renderNewRoleForm()}
          </TabsContent>

          <TabsContent value="sessions" className="mt-0">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-semibold text-white mb-2">Your Roles</h2>
                <p className="text-gray-400">
                  View and continue your previous role deliverables matrices
                </p>
              </div>
              <SessionsList
                currentCompanyId={null}
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
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-semibold text-white mb-2">Saved Requests</h2>
                <p className="text-gray-400">
                  All your generated deliverable requests across all sessions
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
