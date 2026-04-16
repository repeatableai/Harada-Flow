
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Company } from "@/api/entities";
import { User } from "@/api/entities";
import { sanitizeAndConformMatrix } from "../components/common/MatrixSanitizer";
import { useAuth } from "../components/auth/AuthProvider";

import WelcomeStep from "../components/flow/WelcomeStep";
import SessionZeroDossier from "../components/flow/SessionZeroDossier";
import MatrixBuilderStep from "../components/flow/MatrixBuilderStep";
import DeliverableCreatorStep from "../components/flow/DeliverableCreatorStep";
import LoadingOverlay from "../components/common/LoadingOverlay";

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { justLoggedIn, clearJustLoggedIn, isAdmin } = useAuth();
  const [step, setStep] = useState('loading'); // loading, welcome, builder, creator
  const [company, setCompany] = useState(null);
  const [user, setUser] = useState(null);
  const [userCompanies, setUserCompanies] = useState([]);
  const [knowledgeFileIds, setKnowledgeFileIds] = useState([]);

  // Ref to track if we're starting a new role (avoids race condition with loadLatest)
  const isStartingNewRef = useRef(false);

  // Redirect admins to admin dashboard on fresh login
  useEffect(() => {
    if (justLoggedIn && isAdmin()) {
      clearJustLoggedIn();
      navigate('/admin');
    }
  }, [justLoggedIn, isAdmin, clearJustLoggedIn, navigate]);

  // Check for start=new parameter and trigger welcome step
  useEffect(() => {
    const startParam = searchParams.get('start');
    if (startParam === 'new') {
      // Set the ref BEFORE any state changes to ensure loadLatest respects it
      isStartingNewRef.current = true;
      setCompany(null);
      setStep('welcome');
      // Clear the search param after handling
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    // Check if there's an existing session to resume for the current user
    const loadLatest = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);

        // Skip loading if start=new is set (check both URL and ref for race condition safety)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('start') === 'new' || isStartingNewRef.current) {
          return;
        }

        const companies = await Company.filter({ created_by: currentUser.email }, "-created_date", 1);
        setUserCompanies(companies);

        if (companies.length > 0) {
          const lastCompany = companies[0];

          const conformedCompany = {
            ...lastCompany,
            productivity_matrix: sanitizeAndConformMatrix(lastCompany.productivity_matrix, 'productivity'),
            performance_matrix: sanitizeAndConformMatrix(lastCompany.performance_matrix, 'performance'),
          };
          setCompany(conformedCompany);

          // Check dossier status — route to Session 00 if pending
          if (conformedCompany.dossier_status === 'pending' || !conformedCompany.dossier_status) {
            setStep('session-00');
          } else if (!conformedCompany.productivity_matrix || !conformedCompany.performance_matrix) {
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

  const handleCompanyCreated = (newCompany, selectedKnowledgeFileIds = []) => {
    setCompany(newCompany);
    setKnowledgeFileIds(selectedKnowledgeFileIds);
    // Route to Session 00 (Dossier) if dossier not yet done, otherwise skip to builder
    if (newCompany.dossier_status === 'pending' || !newCompany.dossier_status) {
      setStep('session-00');
    } else {
      setStep('builder');
    }
  };

  const handleDossierComplete = (dossierStatus) => {
    // Update company state with new dossier status and advance to builder
    setCompany(prev => ({ ...prev, dossier_status: dossierStatus }));
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
    // Set ref to prevent any pending loadLatest from overriding
    isStartingNewRef.current = true;
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
  };

  const handleLoadSession = (session) => {
    const conformedCompany = {
      ...session,
      productivity_matrix: sanitizeAndConformMatrix(session.productivity_matrix, 'productivity'),
      performance_matrix: sanitizeAndConformMatrix(session.performance_matrix, 'performance'),
    };
    setCompany(conformedCompany);

    // Go to appropriate step based on session state — check dossier first
    if (conformedCompany.dossier_status === 'pending' || !conformedCompany.dossier_status) {
      setStep('session-00');
    } else if (!conformedCompany.productivity_matrix || !conformedCompany.performance_matrix) {
      setStep('builder');
    } else {
      setStep('creator');
    }
  };

  const handleDeleteSession = (sessionId) => {
    // If deleted session is the current one, go back to welcome
    if (company?.id === sessionId) {
      setCompany(null);
      setStep('welcome');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <WelcomeStep
            onCompanyCreated={handleCompanyCreated}
            onLoadSession={handleLoadSession}
            onDeleteSession={handleDeleteSession}
            hasExistingSessions={userCompanies.length > 0}
          />
        );
      case 'session-00':
        return (
          <SessionZeroDossier
            company={company}
            onComplete={handleDossierComplete}
          />
        );
      case 'builder':
        return <MatrixBuilderStep company={company} knowledgeFileIds={knowledgeFileIds} onMatricesFinalized={handleMatricesFinalized} onStartOver={handleStartOver} />;
      case 'creator':
        return (
          <DeliverableCreatorStep
            company={company}
            onStartOver={handleGoToBuilder}
            onLoadSession={handleLoadSession}
            onDeleteSession={handleDeleteSession}
          />
        );
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
