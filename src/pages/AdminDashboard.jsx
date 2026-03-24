import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Briefcase,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  BarChart3,
  Clock,
  Mail,
  Loader2,
  ArrowLeft,
  Timer,
  TrendingUp,
  Zap,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Building2,
  FolderTree,
  UserCog,
  FolderOpen,
  UserPlus,
  Activity,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import CompanyManager from '@/components/admin/CompanyManager';
import DepartmentManager from '@/components/admin/DepartmentManager';
import UserManager from '@/components/admin/UserManager';
import KnowledgeFileManager from '@/components/admin/KnowledgeFileManager';
import AccessRequestManager from '@/components/admin/AccessRequestManager';
import OrganizationSettings from '@/components/admin/OrganizationSettings';

export default function AdminDashboard() {
  const { user, isAdmin, isCompanyAdmin, isSuperAdmin, organization, department } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  // Determine dashboard scope based on role
  const isDeptAdmin = isAdmin() && !isCompanyAdmin();
  const scopeLabel = isSuperAdmin() ? 'System' : isCompanyAdmin() ? (organization?.name || 'Company') : (department?.name || 'Department');
  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState({ data: [], pagination: {} });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyPage, setCompanyPage] = useState(1);
  const [timeStudies, setTimeStudies] = useState({ data: [], pagination: {} });
  const [timeStudyStats, setTimeStudyStats] = useState(null);
  const [timeStudyPage, setTimeStudyPage] = useState(1);

  // Sorting state
  const [companySort, setCompanySort] = useState('-createdAt');

  // Saved Prompts state
  const [savedPrompts, setSavedPrompts] = useState({ data: [], pagination: {} });
  const [savedPromptsStats, setSavedPromptsStats] = useState(null);
  const [savedPromptsPage, setSavedPromptsPage] = useState(1);
  const [savedPromptsSort, setSavedPromptsSort] = useState('-createdAt');
  const [savedPromptsFilter, setSavedPromptsFilter] = useState('all');
  const [savedPromptsSearch, setSavedPromptsSearch] = useState('');
  const [savedPromptsUserFilter, setSavedPromptsUserFilter] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  // Activity log state
  const [activityLogs, setActivityLogs] = useState({ data: [], pagination: {} });
  const [activityStats, setActivityStats] = useState(null);
  const [activityPage, setActivityPage] = useState(1);

  // Check admin access - now supports DEPARTMENT_ADMIN and above
  useEffect(() => {
    if (user && !isAdmin()) {
      navigate('/');
    }
  }, [user, navigate, isAdmin]);

  // Load initial data
  useEffect(() => {
    loadStats();
    loadCompanies(1, '', companySort);
    // Time Savings feature hidden for now - keeping code for future use
    // loadTimeStudyStats();
    // loadTimeStudies(1);
    loadSavedPromptsStats();
    loadSavedPrompts(1);
    loadActivityStats();
    loadActivityLogs(1);
    if (isSuperAdmin()) {
      loadAllUsers();
    }
  }, []);

  const loadAllUsers = async () => {
    try {
      const data = await apiClient.admin.getUsers({ limit: 200 });
      setAllUsers(data.data || []);
    } catch (error) {
      console.error('Failed to load users for filter:', error);
    }
  };

  const loadStats = async () => {
    try {
      const data = await apiClient.admin.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadCompanies = async (page, search = '', sort = companySort) => {
    setIsLoading(true);
    try {
      const data = await apiClient.admin.getCompanies({
        page,
        limit: 10,
        search: search || undefined,
        sort,
      });
      setCompanies(data);
      setCompanyPage(page);
    } catch (error) {
      console.error('Failed to load companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTimeStudyStats = async () => {
    try {
      const data = await apiClient.admin.getTimeStudyStats();
      setTimeStudyStats(data);
    } catch (error) {
      console.error('Failed to load time study stats:', error);
    }
  };

  const loadTimeStudies = async (page) => {
    setIsLoading(true);
    try {
      const data = await apiClient.admin.getTimeStudies({
        page,
        limit: 10,
      });
      setTimeStudies(data);
      setTimeStudyPage(page);
    } catch (error) {
      console.error('Failed to load time studies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedPromptsStats = async () => {
    try {
      const data = await apiClient.admin.getSavedPromptsStats();
      setSavedPromptsStats(data);
    } catch (error) {
      console.error('Failed to load saved prompts stats:', error);
    }
  };

  const loadActivityStats = async () => {
    try {
      const data = await apiClient.admin.getActivityStats();
      setActivityStats(data);
    } catch (error) {
      console.error('Failed to load activity stats:', error);
    }
  };

  const loadActivityLogs = async (page) => {
    try {
      const data = await apiClient.admin.getActivityLogs({
        page,
        limit: 10,
        resourceType: 'knowledge_file',
      });
      setActivityLogs(data);
      setActivityPage(page);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    }
  };

  const loadSavedPrompts = async (page, search = savedPromptsSearch, sort = savedPromptsSort, filter = savedPromptsFilter, userFilter = savedPromptsUserFilter) => {
    setIsLoading(true);
    try {
      const data = await apiClient.admin.getSavedPrompts({
        page,
        limit: 10,
        search: search || undefined,
        sort,
        deliverableType: filter !== 'all' ? filter : undefined,
        userId: userFilter || undefined,
      });
      setSavedPrompts(data);
      setSavedPromptsPage(page);
    } catch (error) {
      console.error('Failed to load saved prompts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySortChange = (newSort) => {
    setCompanySort(newSort);
    loadCompanies(1, searchQuery, newSort);
  };

  const handleSavedPromptsSortChange = (newSort) => {
    setSavedPromptsSort(newSort);
    loadSavedPrompts(1, savedPromptsSearch, newSort, savedPromptsFilter);
  };

  const handleSavedPromptsFilterChange = (newFilter) => {
    setSavedPromptsFilter(newFilter);
    loadSavedPrompts(1, savedPromptsSearch, savedPromptsSort, newFilter, savedPromptsUserFilter);
  };

  const handleSavedPromptsUserFilterChange = (newUserFilter) => {
    setSavedPromptsUserFilter(newUserFilter);
    loadSavedPrompts(1, savedPromptsSearch, savedPromptsSort, savedPromptsFilter, newUserFilter);
  };

  const handleSavedPromptsSearch = () => {
    loadSavedPrompts(1, savedPromptsSearch, savedPromptsSort, savedPromptsFilter, savedPromptsUserFilter);
  };

  const handleSearch = () => {
    if (activeTab === 'companies') {
      loadCompanies(1, searchQuery, companySort);
    }
  };

  const viewCompanyDetails = async (companyId) => {
    try {
      const data = await apiClient.admin.getCompany(companyId);
      setSelectedCompany(data);
    } catch (error) {
      console.error('Failed to load company details:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to App
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {isSuperAdmin() ? 'Super Admin Dashboard' :
                 isCompanyAdmin() ? 'Company Admin Dashboard' :
                 'Department Admin Dashboard'}
              </h1>
              <p className="text-blue-200">
                {isSuperAdmin() ? 'Manage all companies, users, and system settings' :
                 isCompanyAdmin() ? `Manage ${organization?.name || 'your company'} users and departments` :
                 `Manage ${department?.name || 'your department'} users and activity`}
              </p>
            </div>
          </div>
          {/* Scope Badge */}
          <Badge
            className={`${
              isSuperAdmin() ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' :
              isCompanyAdmin() ? 'bg-blue-500/20 text-blue-300 border-blue-500/50' :
              'bg-green-500/20 text-green-300 border-green-500/50'
            } px-3 py-1`}
          >
            {isSuperAdmin() ? (
              <><Building2 className="w-4 h-4 mr-2" />System Wide</>
            ) : isCompanyAdmin() ? (
              <><Building2 className="w-4 h-4 mr-2" />{organization?.name || 'Company'}</>
            ) : (
              <><FolderTree className="w-4 h-4 mr-2" />{department?.name || 'Department'}</>
            )}
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/10 border border-white/20 flex-wrap">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/20 text-white">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="companies" className="data-[state=active]:bg-white/20 text-white">
              <Briefcase className="w-4 h-4 mr-2" />
              Sessions
            </TabsTrigger>
            {/* Time Savings tab hidden - keeping code for future use */}
            <TabsTrigger value="saved-prompts" className="data-[state=active]:bg-white/20 text-white">
              <FileText className="w-4 h-4 mr-2" />
              Saved Requests
            </TabsTrigger>
            <TabsTrigger value="knowledge-files" className="data-[state=active]:bg-white/20 text-white">
              <FolderOpen className="w-4 h-4 mr-2" />
              Knowledge Files
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-white/20 text-white">
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
            {/* Management tabs - role-based visibility */}
            <TabsTrigger value="user-management" className="data-[state=active]:bg-white/20 text-white">
              <UserCog className="w-4 h-4 mr-2" />
              Manage Users
            </TabsTrigger>
            {/* Company Settings tab for Company Admins (not Super Admins - they edit via Companies tab) */}
            {isCompanyAdmin() && !isSuperAdmin() && (
              <TabsTrigger value="company-settings" className="data-[state=active]:bg-white/20 text-white">
                <Building2 className="w-4 h-4 mr-2" />
                Company Settings
              </TabsTrigger>
            )}
            {/* Departments tab only for Company Admins (Super Admins see departments within Companies tab) */}
            {isCompanyAdmin() && !isSuperAdmin() && (
              <TabsTrigger value="departments" className="data-[state=active]:bg-white/20 text-white">
                <FolderTree className="w-4 h-4 mr-2" />
                Departments
              </TabsTrigger>
            )}
            {isSuperAdmin() && (
              <TabsTrigger value="access-requests" className="data-[state=active]:bg-white/20 text-white">
                <UserPlus className="w-4 h-4 mr-2" />
                Access Requests
              </TabsTrigger>
            )}
            {isSuperAdmin() && (
              <TabsTrigger value="companies-management" className="data-[state=active]:bg-white/20 text-white">
                <Building2 className="w-4 h-4 mr-2" />
                Companies
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="bg-white/10 border-white/20">
                <CardHeader className="pb-2">
                  <CardDescription className="text-blue-200">
                    {isDeptAdmin ? 'Department Users' : isCompanyAdmin() && !isSuperAdmin() ? 'Company Users' : 'Total Users'}
                  </CardDescription>
                  <CardTitle className="text-3xl text-white">
                    {stats?.totalUsers || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-blue-300">
                    {stats?.usersByRole?.USER || 0} Regular | {
                      isSuperAdmin()
                        ? (stats?.usersByRole?.ADMIN || 0) + (stats?.usersByRole?.COMPANY_ADMIN || 0) + (stats?.usersByRole?.DEPARTMENT_ADMIN || 0) + (stats?.usersByRole?.SUPER_ADMIN || 0)
                        : isCompanyAdmin() && !isSuperAdmin()
                        ? (stats?.usersByRole?.COMPANY_ADMIN || 0) + (stats?.usersByRole?.DEPARTMENT_ADMIN || 0)
                        : (stats?.usersByRole?.DEPARTMENT_ADMIN || 0)
                    } Admins
                  </p>
                  <p className="text-xs text-blue-300 mt-1">
                    +{stats?.recentUsers || 0} this week
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20">
                <CardHeader className="pb-2">
                  <CardDescription className="text-blue-200">
                    {isDeptAdmin ? 'Department Sessions' : isCompanyAdmin() && !isSuperAdmin() ? 'Company Sessions' : 'Total Sessions'}
                  </CardDescription>
                  <CardTitle className="text-3xl text-white">
                    {stats?.totalCompanies || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-blue-300">
                    +{stats?.recentCompanies || 0} this week
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20">
                <CardHeader className="pb-2">
                  <CardDescription className="text-blue-200">
                    Total Requests
                  </CardDescription>
                  <CardTitle className="text-3xl text-white flex items-center gap-2">
                    {savedPromptsStats?.total || 0}
                    {savedPromptsStats?.customCount > 0 && (
                      <span className="flex items-center text-sm font-normal text-amber-300">
                        <Zap className="w-4 h-4 mr-1" />
                        {savedPromptsStats.customCount} custom
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-blue-300">
                    +{savedPromptsStats?.recentCount || 0} this week
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Saved Requests Summary */}
            {savedPromptsStats && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  Saved Requests Overview
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-500/30">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-purple-200">Total Requests</CardDescription>
                      <CardTitle className="text-3xl text-white">
                        {savedPromptsStats.total || 0}
                      </CardTitle>
                    </CardHeader>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-500/30">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-green-200">Productivity Requests</CardDescription>
                      <CardTitle className="text-3xl text-white">
                        {savedPromptsStats.byType?.productivity || 0}
                      </CardTitle>
                    </CardHeader>
                  </Card>

                  <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-500/30">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-blue-200">Performance Requests</CardDescription>
                      <CardTitle className="text-3xl text-white">
                        {savedPromptsStats.byType?.performance || 0}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>
              </div>
            )}

            {/* Time Savings Summary - Hidden for now, keeping code for future use
            {timeStudyStats && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Timer className="w-5 h-5 text-green-400" />
                  Time Savings Overview
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-500/30">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-green-200">Total Time Saved</CardDescription>
                      <CardTitle className="text-3xl text-white">
                        {timeStudyStats.totalTimeSavedHours}h
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-green-300">
                        {Math.round(timeStudyStats.totalTimeSavedMinutes)} minutes total
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-500/30">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-blue-200">Average Reduction</CardDescription>
                      <CardTitle className="text-3xl text-white">
                        {timeStudyStats.averagePercentReduction}%
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-blue-300">
                        vs. manual creation baseline
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-500/30">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-purple-200">Operations This Week</CardDescription>
                      <CardTitle className="text-3xl text-white">
                        {timeStudyStats.operationsThisWeek}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-purple-300">
                        {timeStudyStats.totalOperations} total operations
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            */}
          </TabsContent>

          {/* Companies/Sessions Tab */}
          <TabsContent value="companies" className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Search by job title, industry, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300 flex-1 min-w-[200px]"
              />
              <Select value={companySort} onValueChange={handleCompanySortChange}>
                <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-createdAt">Newest First</SelectItem>
                  <SelectItem value="createdAt">Oldest First</SelectItem>
                  <SelectItem value="jobTitle">Job Title A-Z</SelectItem>
                  <SelectItem value="-jobTitle">Job Title Z-A</SelectItem>
                  <SelectItem value="industry">Industry A-Z</SelectItem>
                  <SelectItem value="-industry">Industry Z-A</SelectItem>
                  <SelectItem value="createdBy">User A-Z</SelectItem>
                  <SelectItem value="-createdBy">User Z-A</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <Card className="bg-white/10 border-white/20">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-4 text-blue-200 font-medium">Role</th>
                        <th className="text-left p-4 text-blue-200 font-medium">Industry</th>
                        <th className="text-left p-4 text-blue-200 font-medium">User</th>
                        <th className="text-left p-4 text-blue-200 font-medium">Created</th>
                        <th className="text-right p-4 text-blue-200 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.data?.map((c) => (
                        <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-4">
                            <p className="text-white font-medium">{c.job_title}</p>
                            <p className="text-blue-300 text-sm">{c.company_size}</p>
                          </td>
                          <td className="p-4 text-white">{c.industry}</td>
                          <td className="p-4">
                            <p className="text-blue-300 text-sm">{c.created_by}</p>
                          </td>
                          <td className="p-4 text-blue-300 text-sm">
                            {formatDate(c.created_date)}
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => viewCompanyDetails(c.id)}
                              className="text-blue-300 hover:text-white hover:bg-white/10"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {companies.pagination?.totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-white/10">
                    <p className="text-blue-300 text-sm">
                      Page {companies.pagination.page} of {companies.pagination.totalPages}
                      {companies.pagination.total && ` (${companies.pagination.total} total)`}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadCompanies(companyPage - 1, searchQuery, companySort)}
                        disabled={companyPage <= 1}
                        className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadCompanies(companyPage + 1, searchQuery, companySort)}
                        disabled={companyPage >= companies.pagination.totalPages}
                        className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Time Savings Tab - Hidden for now, keeping code for future use
          <TabsContent value="time-savings" className="space-y-4">
            {timeStudyStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-500/30">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-green-200">Total Time Saved</CardDescription>
                    <CardTitle className="text-2xl text-white">
                      {timeStudyStats.totalTimeSavedHours}h
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-500/30">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-blue-200">Avg Reduction</CardDescription>
                    <CardTitle className="text-2xl text-white">
                      {timeStudyStats.averagePercentReduction}%
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white/10 border-white/20">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-blue-200">Total Operations</CardDescription>
                    <CardTitle className="text-2xl text-white">
                      {timeStudyStats.totalOperations}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white/10 border-white/20">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-blue-200">This Week</CardDescription>
                    <CardTitle className="text-2xl text-white">
                      {timeStudyStats.operationsThisWeek}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>
            )}

            <Card className="bg-white/10 border-white/20">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-4 text-blue-200 font-medium">User</th>
                        <th className="text-left p-4 text-blue-200 font-medium">Operation</th>
                        <th className="text-left p-4 text-blue-200 font-medium">Details</th>
                        <th className="text-right p-4 text-blue-200 font-medium">Baseline</th>
                        <th className="text-right p-4 text-blue-200 font-medium">Actual</th>
                        <th className="text-right p-4 text-blue-200 font-medium">Saved</th>
                        <th className="text-right p-4 text-blue-200 font-medium">%</th>
                        <th className="text-left p-4 text-blue-200 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeStudies.data?.map((ts) => (
                        <tr key={ts.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-4">
                            <p className="text-blue-300 text-sm">{ts.user?.email || 'Unknown'}</p>
                          </td>
                          <td className="p-4">
                            <Badge
                              variant="outline"
                              className={
                                ts.operationType === 'productivity_matrix'
                                  ? 'border-green-400 text-green-300'
                                  : ts.operationType === 'performance_matrix'
                                  ? 'border-blue-400 text-blue-300'
                                  : 'border-purple-400 text-purple-300'
                              }
                            >
                              {ts.operationType?.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <p className="text-white text-sm">{ts.operationName || '-'}</p>
                          </td>
                          <td className="p-4 text-right text-blue-300 text-sm">
                            {ts.baselineManualMinutes} min
                          </td>
                          <td className="p-4 text-right text-blue-300 text-sm">
                            {typeof ts.actualMinutes === 'number' ? ts.actualMinutes.toFixed(1) : ts.actualMinutes} min
                          </td>
                          <td className="p-4 text-right text-green-400 font-medium">
                            {typeof ts.minutesSaved === 'number' ? Math.round(ts.minutesSaved) : ts.minutesSaved} min
                          </td>
                          <td className="p-4 text-right">
                            <span className="text-green-400 font-bold">
                              {typeof ts.percentReduction === 'number' ? ts.percentReduction.toFixed(1) : ts.percentReduction}%
                            </span>
                          </td>
                          <td className="p-4 text-blue-300 text-sm">
                            {formatDate(ts.createdAt)}
                          </td>
                        </tr>
                      ))}
                      {(!timeStudies.data || timeStudies.data.length === 0) && (
                        <tr>
                          <td colSpan="8" className="p-8 text-center text-blue-300">
                            No time studies recorded yet. Generate matrices or prompts to start tracking.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {timeStudies.pagination?.totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-white/10">
                    <p className="text-blue-300 text-sm">
                      Page {timeStudies.pagination.page} of {timeStudies.pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadTimeStudies(timeStudyPage - 1)}
                        disabled={timeStudyPage <= 1}
                        className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadTimeStudies(timeStudyPage + 1)}
                        disabled={timeStudyPage >= timeStudies.pagination.totalPages}
                        className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          */}

          {/* Saved Requests Tab */}
          <TabsContent value="saved-prompts" className="space-y-4">
            {/* Summary Stats */}
            {savedPromptsStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-500/30">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-purple-200">Total Requests</CardDescription>
                    <CardTitle className="text-2xl text-white">
                      {savedPromptsStats.total}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-500/30">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-green-200">Productivity</CardDescription>
                    <CardTitle className="text-2xl text-white">
                      {savedPromptsStats.byType?.productivity || 0}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-500/30">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-blue-200">Performance</CardDescription>
                    <CardTitle className="text-2xl text-white">
                      {savedPromptsStats.byType?.performance || 0}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white/10 border-white/20">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-blue-200">This Week</CardDescription>
                    <CardTitle className="text-2xl text-white">
                      {savedPromptsStats.recentCount}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>
            )}

            {/* Search, Filter, Sort */}
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Search by deliverable name, column, or overview..."
                value={savedPromptsSearch}
                onChange={(e) => setSavedPromptsSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSavedPromptsSearch()}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300 flex-1 min-w-[200px]"
              />
              {isSuperAdmin() && (
                <Select value={savedPromptsUserFilter || '__all__'} onValueChange={(val) => handleSavedPromptsUserFilterChange(val === '__all__' ? '' : val)}>
                  <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
                    <Users className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Users</SelectItem>
                    {allUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={savedPromptsFilter} onValueChange={handleSavedPromptsFilterChange}>
                <SelectTrigger className="w-[150px] bg-white/10 border-white/20 text-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="productivity">Productivity</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={savedPromptsSort} onValueChange={handleSavedPromptsSortChange}>
                <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-createdAt">Newest First</SelectItem>
                  <SelectItem value="createdAt">Oldest First</SelectItem>
                  <SelectItem value="deliverableName">Name A-Z</SelectItem>
                  <SelectItem value="-deliverableName">Name Z-A</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSavedPromptsSearch} className="bg-blue-600 hover:bg-blue-700">
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <Card className="bg-white/10 border-white/20">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-4 text-blue-200 font-medium">Deliverable</th>
                        <th className="text-left p-4 text-blue-200 font-medium">Category</th>
                        <th className="text-left p-4 text-blue-200 font-medium">User</th>
                        <th className="text-left p-4 text-blue-200 font-medium">Session</th>
                        <th className="text-left p-4 text-blue-200 font-medium">Created</th>
                        <th className="text-right p-4 text-blue-200 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedPrompts.data?.map((prompt) => (
                        <tr key={prompt.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-4">
                            <p className="text-white font-medium">{prompt.deliverable_name}</p>
                            <p className="text-blue-300 text-sm truncate max-w-[200px]">
                              {prompt.overview?.substring(0, 60)}...
                            </p>
                          </td>
                          <td className="p-4 text-white text-sm">
                            {prompt.column_name || '-'}
                          </td>
                          <td className="p-4">
                            <p className="text-blue-300 text-sm">
                              {prompt.company?.user?.email || prompt.company?.created_by || '-'}
                            </p>
                          </td>
                          <td className="p-4">
                            <p className="text-white text-sm">{prompt.company?.job_title || '-'}</p>
                            <p className="text-blue-300 text-xs">{prompt.company?.industry || '-'}</p>
                          </td>
                          <td className="p-4 text-blue-300 text-sm">
                            {formatDate(prompt.created_at)}
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedPrompt(prompt)}
                              className="text-blue-300 hover:text-white hover:bg-white/10"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {(!savedPrompts.data || savedPrompts.data.length === 0) && (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-blue-300">
                            No saved requests found. Users save requests when generating deliverable content.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {savedPrompts.pagination?.totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-white/10">
                    <p className="text-blue-300 text-sm">
                      Page {savedPrompts.pagination.page} of {savedPrompts.pagination.totalPages}
                      {savedPrompts.pagination.total && ` (${savedPrompts.pagination.total} total)`}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadSavedPrompts(savedPromptsPage - 1)}
                        disabled={savedPromptsPage <= 1}
                        className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadSavedPrompts(savedPromptsPage + 1)}
                        disabled={savedPromptsPage >= savedPrompts.pagination.totalPages}
                        className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Knowledge Files Tab */}
          <TabsContent value="knowledge-files" className="space-y-4">
            <KnowledgeFileManager />
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            {/* Activity Stats */}
            {activityStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 border-indigo-500/30">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-indigo-200">Total Activity</CardDescription>
                    <CardTitle className="text-2xl text-white">
                      {activityStats.totalLogs || 0}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-500/30">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-green-200">File Uploads</CardDescription>
                    <CardTitle className="text-2xl text-white">
                      {activityStats.byType?.file_upload || 0}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white/10 border-white/20">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-blue-200">This Week</CardDescription>
                    <CardTitle className="text-2xl text-white">
                      {activityStats.recentLogs || 0}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>
            )}

            {/* Activity Log Table */}
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  Knowledge File Activity
                </CardTitle>
                <CardDescription className="text-blue-200">
                  File uploads and access within your {isDeptAdmin ? 'department' : isCompanyAdmin() && !isSuperAdmin() ? 'company' : 'organization'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-4 text-blue-200 font-medium">Activity</th>
                        <th className="text-left p-4 text-blue-200 font-medium">File</th>
                        <th className="text-left p-4 text-blue-200 font-medium">User</th>
                        <th className="text-left p-4 text-blue-200 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityLogs.data?.map((log) => (
                        <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-4">
                            <Badge
                              variant="outline"
                              className={
                                log.activityType === 'file_upload'
                                  ? 'border-green-400 text-green-300'
                                  : 'border-blue-400 text-blue-300'
                              }
                            >
                              {log.activityType === 'file_upload' ? 'Upload' : 'Access'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <p className="text-white text-sm">{log.metadata?.fileName || '-'}</p>
                            <p className="text-blue-300 text-xs">{log.metadata?.fileType || '-'}</p>
                          </td>
                          <td className="p-4 text-blue-300 text-sm">
                            {log.metadata?.userName || '-'}
                          </td>
                          <td className="p-4 text-blue-300 text-sm">
                            {formatDate(log.createdAt)}
                          </td>
                        </tr>
                      ))}
                      {(!activityLogs.data || activityLogs.data.length === 0) && (
                        <tr>
                          <td colSpan="4" className="p-8 text-center text-blue-300">
                            No activity recorded yet. File uploads and downloads will appear here.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {activityLogs.pagination?.totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-white/10">
                    <p className="text-blue-300 text-sm">
                      Page {activityLogs.pagination.page} of {activityLogs.pagination.totalPages}
                      {activityLogs.pagination.total && ` (${activityLogs.pagination.total} total)`}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadActivityLogs(activityPage - 1)}
                        disabled={activityPage <= 1}
                        className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadActivityLogs(activityPage + 1)}
                        disabled={activityPage >= activityLogs.pagination.totalPages}
                        className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="user-management" className="space-y-4">
            <UserManager />
          </TabsContent>

          {/* Company Settings Tab (Company Admins only) */}
          {isCompanyAdmin() && !isSuperAdmin() && (
            <TabsContent value="company-settings" className="space-y-4">
              <OrganizationSettings />
            </TabsContent>
          )}

          {/* Departments Tab (Company Admins only - Super Admins see departments within Companies tab) */}
          {isCompanyAdmin() && !isSuperAdmin() && (
            <TabsContent value="departments" className="space-y-4">
              <DepartmentManager />
            </TabsContent>
          )}

          {/* Access Requests Tab (Super Admin only) */}
          {isSuperAdmin() && (
            <TabsContent value="access-requests" className="space-y-4">
              <AccessRequestManager />
            </TabsContent>
          )}

          {/* Companies Tab (Super Admin only) */}
          {isSuperAdmin() && (
            <TabsContent value="companies-management" className="space-y-4">
              <CompanyManager />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Company Details Dialog */}
      <Dialog open={!!selectedCompany} onOpenChange={() => setSelectedCompany(null)}>
        <DialogContent className="sm:max-w-3xl bg-slate-900 border-white/20 text-white max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-400" />
              Session Details
            </DialogTitle>
            <DialogDescription>View company and matrix information</DialogDescription>
          </DialogHeader>
          {selectedCompany && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-blue-300 text-sm">Job Title</p>
                    <p className="text-white">{selectedCompany.job_title}</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-sm">Industry</p>
                    <p className="text-white">{selectedCompany.industry}</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-sm">Company Size</p>
                    <p className="text-white">{selectedCompany.company_size}</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-sm">Created By</p>
                    <p className="text-white">{selectedCompany.created_by}</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-sm">Created</p>
                    <p className="text-white">{formatDate(selectedCompany.created_date)}</p>
                  </div>
                  {selectedCompany.company_url && (
                    <div>
                      <p className="text-blue-300 text-sm">Company URL</p>
                      <a
                        href={selectedCompany.company_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {selectedCompany.company_url}
                      </a>
                    </div>
                  )}
                </div>

                {selectedCompany.productivity_matrix && (
                  <div>
                    <p className="text-blue-300 text-sm mb-2">Productivity Matrix</p>
                    <div className="bg-white/5 rounded-lg p-3 text-sm">
                      <p className="text-white font-medium mb-2">
                        {selectedCompany.productivity_matrix.title}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {selectedCompany.productivity_matrix.columns?.slice(0, 8).map((col, i) => (
                          <div key={i} className="bg-white/5 p-2 rounded">
                            <p className="text-blue-300 text-xs font-medium">{col.name}</p>
                            <p className="text-white text-xs">
                              {col.deliverables?.length || 0} deliverables
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedCompany.performance_matrix && (
                  <div>
                    <p className="text-blue-300 text-sm mb-2">Performance Matrix</p>
                    <div className="bg-white/5 rounded-lg p-3 text-sm">
                      <p className="text-white font-medium mb-2">
                        {selectedCompany.performance_matrix.title}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {selectedCompany.performance_matrix.columns?.slice(0, 8).map((col, i) => (
                          <div key={i} className="bg-white/5 p-2 rounded">
                            <p className="text-blue-300 text-xs font-medium">{col.name}</p>
                            <p className="text-white text-xs">
                              {col.problems?.length || 0} problems
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Saved Request Details Dialog */}
      <Dialog open={!!selectedPrompt} onOpenChange={() => setSelectedPrompt(null)}>
        <DialogContent className="sm:max-w-3xl bg-slate-900 border-white/20 text-white max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Saved Request Details
            </DialogTitle>
            <DialogDescription>View deliverable request information</DialogDescription>
          </DialogHeader>
          {selectedPrompt && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-blue-300 text-sm">Deliverable Name</p>
                    <p className="text-white font-medium">{selectedPrompt.deliverable_name}</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-sm">Type</p>
                    <Badge
                      variant="outline"
                      className={
                        selectedPrompt.deliverable_type === 'productivity'
                          ? 'border-green-400 text-green-300'
                          : 'border-blue-400 text-blue-300'
                      }
                    >
                      {selectedPrompt.deliverable_type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-blue-300 text-sm">Column</p>
                    <p className="text-white">{selectedPrompt.column_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-sm">Created</p>
                    <p className="text-white">{formatDate(selectedPrompt.created_at)}</p>
                  </div>
                  {selectedPrompt.company && (
                    <>
                      <div>
                        <p className="text-blue-300 text-sm">Session</p>
                        <p className="text-white">{selectedPrompt.company.job_title}</p>
                        <p className="text-blue-300 text-xs">{selectedPrompt.company.industry}</p>
                      </div>
                      <div>
                        <p className="text-blue-300 text-sm">User</p>
                        <p className="text-white">
                          {selectedPrompt.company.user?.email || selectedPrompt.company.created_by}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <p className="text-blue-300 text-sm mb-2">Overview</p>
                  <div className="bg-white/5 rounded-lg p-3 text-sm text-white whitespace-pre-wrap">
                    {selectedPrompt.overview}
                  </div>
                </div>

                {selectedPrompt.prompts && selectedPrompt.prompts.length > 0 && (
                  <div>
                    <p className="text-blue-300 text-sm mb-2">
                      Requests ({selectedPrompt.prompts.length} steps)
                    </p>
                    <div className="space-y-3">
                      {selectedPrompt.prompts.map((p, i) => (
                        <div key={i} className="bg-white/5 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="border-purple-400 text-purple-300">
                              Step {p.step || i + 1}
                            </Badge>
                            <p className="text-white font-medium">{p.title}</p>
                          </div>
                          {p.description && (
                            <p className="text-blue-300 text-sm mb-2">{p.description}</p>
                          )}
                          <div className="bg-black/20 rounded p-2 text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {p.prompt}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
