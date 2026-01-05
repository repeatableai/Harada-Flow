
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Company } from "@/api/entities";
import { Sparkles, Building, User, Globe, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";

export default function WelcomeStep({ onCompanyCreated }) {
  const [formData, setFormData] = useState({
    job_title: "",
    industry: "",
    company_size: "",
    company_url: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (currentUser && currentUser.job_title) {
          setFormData(prev => ({ ...prev, job_title: currentUser.job_title }));
        }
      } catch (error) {
        console.warn("Could not fetch current user, or user is not logged in.", error);
      } finally {
        setIsLoadingUser(false);
      }
    };
    fetchUser();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // First, create the company session record
      const newCompany = await Company.create(formData);
      
      // Then, update the user's profile with the new job title non-blockingly
      base44.auth.updateMe({ job_title: formData.job_title }).catch(err => {
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

  return (
    <div className="min-h-[calc(100vh-128px)] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
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
                      Company Website (Optional)
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
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
