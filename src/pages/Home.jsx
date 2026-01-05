
import React, { useState, useEffect } from "react";
import { Company } from "@/api/entities";
import { User } from "@/api/entities";
import { sanitizeAndConformMatrix } from "../components/common/MatrixSanitizer";

import WelcomeStep from "../components/flow/WelcomeStep";
import MatrixBuilderStep from "../components/flow/MatrixBuilderStep";
import DeliverableCreatorStep from "../components/flow/DeliverableCreatorStep";
import LoadingOverlay from "../components/common/LoadingOverlay";

export default function HomePage() {
  const [step, setStep] = useState('loading'); // loading, welcome, builder, creator
  const [company, setCompany] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if there's an existing session to resume for the current user
    const loadLatest = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        
        const urlParams = new URLSearchParams(window.location.search);
        const forceWelcome = urlParams.get('start') === 'new';
        
        if (forceWelcome) {
          setStep('welcome');
          return;
        }
        
        const userCompanies = await Company.filter({ created_by: currentUser.email }, "-created_date", 1);
        
        if (userCompanies.length > 0) {
          const lastCompany = userCompanies[0];
          
          const conformedCompany = {
            ...lastCompany,
            productivity_matrix: sanitizeAndConformMatrix(lastCompany.productivity_matrix, 'productivity'),
            performance_matrix: sanitizeAndConformMatrix(lastCompany.performance_matrix, 'performance'),
          };
          setCompany(conformedCompany);

          if (!conformedCompany.productivity_matrix || !conformedCompany.performance_matrix) {
            setStep('builder');
          } else {
            setStep('creator');
          }
        } else {
          setStep('welcome');
        }
      } catch (error) {
        console.error("Error loading user data:", error);
        
        // Check if it's an authentication error
        const isAuthError = error?.message?.includes('Not authenticated') || 
                           error?.message?.includes('404') || 
                           error?.message?.includes('not found') || 
                           error?.status === 404 ||
                           error?.response?.status === 404;
        
        if (isAuthError) {
          // MockAuthProvider will handle showing login dialog
          // Just show welcome step for now
          setStep('welcome');
        } else {
          // Other errors - show welcome step
          setStep('welcome');
        }
      }
    };
    loadLatest();
  }, []);

  const handleCompanyCreated = (newCompany) => {
    setCompany(newCompany);
    setStep('builder');
  };
  
  const handleMatricesFinalized = (updatedCompany) => {
    const conformedCompany = {
      ...updatedCompany,
      productivity_matrix: sanitizeAndConformMatrix(updatedCompany.productivity_matrix, 'productivity'),
      performance_matrix: sanitizeAndConformMatrix(updatedCompany.performance_matrix, 'performance'),
    };
    setCompany(conformedCompany);
    setStep('creator');
  };
  
  const handleStartOver = () => {
    setCompany(null);
    setStep('welcome');
    window.history.replaceState({}, '', window.location.pathname);
  };
  
  const handleGoToBuilder = (updatedCompany) => {
      const conformedCompany = {
        ...updatedCompany,
        productivity_matrix: sanitizeAndConformMatrix(updatedCompany.productivity_matrix, 'productivity'),
        performance_matrix: sanitizeAndConformMatrix(updatedCompany.performance_matrix, 'performance'),
      };
      setCompany(conformedCompany);
      setStep('builder');
  }

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return <WelcomeStep onCompanyCreated={handleCompanyCreated} />;
      case 'builder':
        return <MatrixBuilderStep company={company} onMatricesFinalized={handleMatricesFinalized} onStartOver={handleStartOver} />;
      case 'creator':
        return <DeliverableCreatorStep company={company} onStartOver={handleGoToBuilder} />;
      case 'loading':
      default:
        return <LoadingOverlay message="Loading your session..." />;
    }
  };

  return (
    <div className="flex-1">
       {renderStep()}
    </div>
  );
}
