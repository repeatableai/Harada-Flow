import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Company, User as UserApi } from "@/api/entities";
import { apiClient } from "@/api/apiClient";
import { Sparkles, Building, User, Globe, ArrowRight, Info, FolderOpen, ChevronDown, ChevronUp, Plus, Bookmark, FileUp, Edit3, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import FileUploadArea from "@/components/common/FileUploadArea";
import SessionsList from "@/components/dashboard/SessionsList";
import SavedPromptsList from "@/components/dashboard/SavedPromptsList";

export default function WelcomeStep({ onCompanyCreated, onLoadSession, onDeleteSession, hasExistingSessions = false }) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(hasExistingSessions ? 'sessions' : 'new');
  const [inputMode, setInputMode] = useState(null); // 'form' | 'upload' | null
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

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);

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
        uploaded.push(result);
      } catch (error) {
        console.error('Failed to upload file:', file.name, error);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // First, create the company session record
      const newCompany = await Company.create(formData);

      // Link uploaded files to the new company (non-blocking)
      if (uploadedFiles.length > 0) {
        Promise.all(
          uploadedFiles.map(file =>
            apiClient.knowledgeFiles.linkToCompany(file.id, newCompany.id).catch(err => {
              console.error('Failed to link file to company:', file.originalName, err);
            })
          )
        ).catch(err => {
          console.error('Failed to link files to company:', err);
        });
      }

      // Then, update the user's profile with the new job title non-blockingly
      UserApi.updateMe({ job_title: formData.job_title }).catch(err => {
        console.error("Failed to update user profile:", err);
      });

      onCompanyCreated(newCompany);
    } catch (error) {
      console.error("Error saving company data:", error);
    }

    setIsSubmitting(false);
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
        company_url: extractionResult.company_url || '',
        source_type: 'file_upload'
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

      onCompanyCreated(newCompany);
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

  const renderModeSelector = () => (
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
          Choose how you'd like to define your role
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <Card
          className="bg-white/10 backdrop-blur-lg border-white/20 cursor-pointer hover:bg-white/15 hover:border-blue-400/50 transition-all duration-300 group"
          onClick={() => setInputMode('form')}
        >
          <CardContent className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-2xl mb-4 group-hover:bg-blue-500/30 transition-colors">
              <Edit3 className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Build from Role Details</h3>
            <p className="text-blue-200 text-sm">
              Fill out a form with your job title, industry, and company size
            </p>
          </CardContent>
        </Card>

        <Card
          className="bg-white/10 backdrop-blur-lg border-white/20 cursor-pointer hover:bg-white/15 hover:border-purple-400/50 transition-all duration-300 group"
          onClick={() => setInputMode('upload')}
        >
          <CardContent className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-2xl mb-4 group-hover:bg-purple-500/30 transition-colors">
              <FileUp className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Upload Role Documents</h3>
            <p className="text-purple-200 text-sm">
              Upload job descriptions, org charts, or role documents - AI extracts the details
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Subtle Repeatable AI branding */}
      <div className="flex items-center justify-center space-x-2 mt-8 opacity-60">
        <span className="text-sm text-blue-300">Powered by</span>
        <img
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/199aedeea_FinalRepeatableLogowithoutbackground1.png"
          alt="Repeatable AI"
          className="h-6 w-auto"
        />
      </div>
    </div>
  );

  const renderUploadOnlyForm = () => (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl mb-6">
          <FileUp className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Upload Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Role Documents</span>
        </h1>
        <p className="text-xl text-blue-200 max-w-2xl mx-auto leading-relaxed">
          Upload job descriptions, org charts, or any documents that describe your role. Our AI will extract the details automatically.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
              <FolderOpen className="w-6 h-6 text-purple-400" />
              Upload Documents
            </CardTitle>
            <p className="text-blue-200">
              Upload PDF, Word, or text files that describe your role, responsibilities, or company.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <FileUploadArea
              files={uploadedFiles}
              onFilesSelected={handleFilesSelected}
              onRemoveFile={handleRemoveFile}
              isUploading={isUploadingFiles}
              maxFiles={5}
              disabled={isSubmitting}
            />

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setInputMode(null);
                  setUploadedFiles([]);
                }}
                className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleUploadOnlySubmit}
                disabled={!isUploadValid || isSubmitting}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold disabled:opacity-50"
              >
                {isExtractingRole ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Documents...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Extract & Generate
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );

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
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
              <Building className="w-6 h-6 text-blue-400" />
              Tell us about your role
            </CardTitle>
            <p className="text-blue-200">
              We'll use this information to create personalized matrices for your specific position and industry.
            </p>
          </CardHeader>
          <CardContent>
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

                {/* Knowledge Files Upload Section */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFileUpload(!showFileUpload)}
                    className="flex items-center gap-2 text-blue-300 hover:text-white transition-colors group"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Add reference files (optional)</span>
                    {uploadedFiles.length > 0 && (
                      <span className="text-xs bg-blue-500/30 px-2 py-0.5 rounded-full">
                        {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {showFileUpload ? (
                      <ChevronUp className="w-4 h-4 ml-auto" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ml-auto" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showFileUpload && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
                          <p className="text-blue-200 text-sm mb-3">
                            Upload documents about your role, company processes, or industry standards
                            to help generate more relevant deliverables matrices.
                          </p>
                          <FileUploadArea
                            files={uploadedFiles}
                            onFilesSelected={handleFilesSelected}
                            onRemoveFile={handleRemoveFile}
                            isUploading={isUploadingFiles}
                            maxFiles={5}
                            disabled={isSubmitting}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setInputMode(null);
                      setShowFileUpload(false);
                    }}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isFormValid || isSubmitting || isLoadingUser}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
                Sessions
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
            {inputMode === null && renderModeSelector()}
            {inputMode === 'form' && renderNewRoleForm()}
            {inputMode === 'upload' && renderUploadOnlyForm()}
          </TabsContent>

          <TabsContent value="sessions" className="mt-0">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-semibold text-white mb-2">Your Sessions</h2>
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
