import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutGrid, RefreshCw, LogOut, Shield, User, Building2, FolderTree, Settings, ChevronDown, FolderOpen } from "lucide-react";
import { usePermissions } from "@/components/common/usePermissions";
import SessionWarning from "@/components/auth/SessionWarning";
import { useAuth } from "@/components/auth/AuthProvider";
import KnowledgeFilesPanel from "@/components/common/KnowledgeFilesPanel";
import VoiceAgent from "@/components/common/VoiceAgent";

function getInitials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return '??';
}

export default function Layout({ children }) {
  const { hasPermission, isLoading } = usePermissions();
  const { user: currentUser, logout } = useAuth();
  const [showFilesPanel, setShowFilesPanel] = useState(false);

  // Check if user has any admin role (includes all admin levels in hierarchy)
  const isAdmin = currentUser && (
    currentUser.role === 'DEPARTMENT_ADMIN' ||
    currentUser.role === 'COMPANY_ADMIN' ||
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.userType === 'superadmin'
  );

  // Helper to get badge styling and text based on role
  const getRoleBadgeInfo = () => {
    if (!currentUser) return null;

    const role = currentUser.role;

    if (role === 'SUPER_ADMIN' || currentUser.userType === 'superadmin') {
      return {
        gradient: 'bg-gradient-to-r from-purple-500 to-pink-600',
        icon: Shield,
        label: 'Super Admin'
      };
    }
    if (role === 'COMPANY_ADMIN' || role === 'ADMIN') {
      return {
        gradient: 'bg-gradient-to-r from-blue-500 to-indigo-600',
        icon: Building2,
        label: 'Company Admin'
      };
    }
    if (role === 'DEPARTMENT_ADMIN') {
      return {
        gradient: 'bg-gradient-to-r from-green-500 to-emerald-600',
        icon: FolderTree,
        label: 'Dept Admin'
      };
    }
    return {
      gradient: 'bg-gradient-to-r from-slate-500 to-slate-600',
      icon: User,
      label: 'User'
    };
  };

  const roleBadge = getRoleBadgeInfo();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden flex flex-col">
      {/* Hide base44 edit button */}
      <style>{`
        [data-testid="edit-with-base44-button"],
        .base44-edit-button,
        button[aria-label*="Edit with base44"],
        button[title*="Edit with base44"] {
          display: none !important;
        }
      `}</style>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/5 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to={createPageUrl("Home")} className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <LayoutGrid className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Role Deliverables Matrices</h1>
                <p className="text-xs text-blue-200">AI-Powered Role Optimization</p>
              </div>
            </Link>
            
            <div className="flex items-center space-x-4">
              {currentUser && roleBadge && (
                <Badge
                  className={`${roleBadge.gradient} text-white flex items-center gap-1`}
                >
                  <roleBadge.icon className="w-3 h-3" />
                  {roleBadge.label}
                </Badge>
              )}
              {currentUser && (
                <Button
                  variant="ghost"
                  onClick={() => setShowFilesPanel(true)}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Files</span>
                </Button>
              )}
              {isAdmin && (
                <Link to="/admin">
                  <Button
                    variant="ghost"
                    className="bg-purple-500/20 border border-purple-400/30 text-purple-200 hover:bg-purple-500/30"
                  >
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
              )}
              <Link to="/?start=new">
                  <Button
                    variant="ghost"
                    className="bg-white/10 border border-white/20 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isLoading && !hasPermission('can_start_new_role')}
                    title={!isLoading && !hasPermission('can_start_new_role') ? "You don't have permission to start a new role" : "Start a new role session"}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Roles
                  </Button>
              </Link>

              {/* User Menu Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="bg-white/10 border border-white/20 text-white hover:bg-white/20 flex items-center gap-2"
                  >
                    <Avatar className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600">
                      <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs">
                        {getInitials(currentUser?.name, currentUser?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline max-w-[120px] truncate">
                      {currentUser?.name || currentUser?.email?.split('@')[0] || 'User'}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-white/20">
                  <div className="px-3 py-2">
                    <p className="text-sm text-white font-medium truncate">
                      {currentUser?.name || 'User'}
                    </p>
                    <p className="text-xs text-blue-300 truncate">
                      {currentUser?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem asChild className="text-blue-200 hover:text-white focus:text-white focus:bg-white/10 cursor-pointer">
                    <Link to="/settings" className="flex items-center">
                      <Settings className="w-4 h-4 mr-2" />
                      Account Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-300 hover:text-red-200 focus:text-red-200 focus:bg-red-500/20 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="hidden md:flex items-center space-x-3 pl-4 border-l border-white/20">
                <span className="text-sm text-blue-200">Powered by</span>
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/d6c37146a_RepeatableAi1.png"
                  alt="Repeatable AI"
                  className="h-8 w-auto opacity-90 hover:opacity-100 transition-opacity duration-200"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col">
        <SessionWarning />
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-white/5 backdrop-blur-lg border-t border-white/10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-blue-200">
              © 2025 Repeatable AI, all rights reserved. Elevate your productivity!
            </p>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-xs text-blue-300">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/d6c37146a_RepeatableAi1.png"
                  alt="Repeatable AI"
                  className="h-4 w-auto opacity-70"
                />
                <span>AI-Powered</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Knowledge Files Panel */}
      <KnowledgeFilesPanel
        open={showFilesPanel}
        onOpenChange={setShowFilesPanel}
      />

      {/* Voice Assistant */}
      <VoiceAgent />
    </div>
  );
}
