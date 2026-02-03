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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState({ data: [], pagination: {} });
  const [companies, setCompanies] = useState({ data: [], pagination: {} });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [userPage, setUserPage] = useState(1);
  const [companyPage, setCompanyPage] = useState(1);
  const [timeStudies, setTimeStudies] = useState({ data: [], pagination: {} });
  const [timeStudyStats, setTimeStudyStats] = useState(null);
  const [timeStudyPage, setTimeStudyPage] = useState(1);

  // Check admin access
  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.userType !== 'superadmin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Load initial data
  useEffect(() => {
    loadStats();
    loadUsers(1);
    loadCompanies(1);
    loadTimeStudyStats();
    loadTimeStudies(1);
  }, []);

  const loadStats = async () => {
    try {
      const data = await apiClient.admin.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadUsers = async (page, search = '') => {
    setIsLoading(true);
    try {
      const data = await apiClient.admin.getUsers({
        page,
        limit: 10,
        search: search || undefined,
      });
      setUsers(data);
      setUserPage(page);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCompanies = async (page, search = '') => {
    setIsLoading(true);
    try {
      const data = await apiClient.admin.getCompanies({
        page,
        limit: 10,
        search: search || undefined,
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

  const handleSearch = () => {
    if (activeTab === 'users') {
      loadUsers(1, searchQuery);
    } else if (activeTab === 'companies') {
      loadCompanies(1, searchQuery);
    }
  };

  const viewUserDetails = async (userId) => {
    try {
      const data = await apiClient.admin.getUser(userId);
      setSelectedUser(data);
    } catch (error) {
      console.error('Failed to load user details:', error);
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
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-blue-200">View and manage user activity</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/10 border border-white/20">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/20 text-white">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-white/20 text-white">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="companies" className="data-[state=active]:bg-white/20 text-white">
              <Briefcase className="w-4 h-4 mr-2" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="time-savings" className="data-[state=active]:bg-white/20 text-white">
              <Timer className="w-4 h-4 mr-2" />
              Time Savings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white/10 border-white/20">
                <CardHeader className="pb-2">
                  <CardDescription className="text-blue-200">Total Users</CardDescription>
                  <CardTitle className="text-3xl text-white">
                    {stats?.totalUsers || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-blue-300">
                    +{stats?.recentUsers || 0} this week
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20">
                <CardHeader className="pb-2">
                  <CardDescription className="text-blue-200">Total Sessions</CardDescription>
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
                  <CardDescription className="text-blue-200">Regular Users</CardDescription>
                  <CardTitle className="text-3xl text-white">
                    {stats?.usersByRole?.USER || 0}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card className="bg-white/10 border-white/20">
                <CardHeader className="pb-2">
                  <CardDescription className="text-blue-200">Admins</CardDescription>
                  <CardTitle className="text-3xl text-white">
                    {(stats?.usersByRole?.ADMIN || 0) + (stats?.usersByRole?.SUPER_ADMIN || 0)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Time Savings Summary */}
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
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300"
              />
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
                        <th className="text-left p-4 text-blue-200 font-medium">User</th>
                        <th className="text-left p-4 text-blue-200 font-medium">Role</th>
                        <th className="text-left p-4 text-blue-200 font-medium">Sessions</th>
                        <th className="text-left p-4 text-blue-200 font-medium">Last Login</th>
                        <th className="text-right p-4 text-blue-200 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.data?.map((u) => (
                        <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-4">
                            <div>
                              <p className="text-white font-medium">{u.name || 'Unknown'}</p>
                              <p className="text-blue-300 text-sm">{u.email}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge
                              variant="outline"
                              className={
                                u.role === 'SUPER_ADMIN'
                                  ? 'border-purple-400 text-purple-300'
                                  : u.role === 'ADMIN'
                                  ? 'border-blue-400 text-blue-300'
                                  : 'border-gray-400 text-gray-300'
                              }
                            >
                              {u.role}
                            </Badge>
                          </td>
                          <td className="p-4 text-white">{u.companiesCount || 0}</td>
                          <td className="p-4 text-blue-300 text-sm">
                            {formatDate(u.lastLoginAt)}
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => viewUserDetails(u.id)}
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
                {users.pagination?.totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-white/10">
                    <p className="text-blue-300 text-sm">
                      Page {users.pagination.page} of {users.pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadUsers(userPage - 1, searchQuery)}
                        disabled={userPage <= 1}
                        className="border-white/20 text-white"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadUsers(userPage + 1, searchQuery)}
                        disabled={userPage >= users.pagination.totalPages}
                        className="border-white/20 text-white"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Companies/Sessions Tab */}
          <TabsContent value="companies" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by job title, industry, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-white/10 border-white/20 text-white placeholder-blue-300"
              />
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
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadCompanies(companyPage - 1, searchQuery)}
                        disabled={companyPage <= 1}
                        className="border-white/20 text-white"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadCompanies(companyPage + 1, searchQuery)}
                        disabled={companyPage >= companies.pagination.totalPages}
                        className="border-white/20 text-white"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Time Savings Tab */}
          <TabsContent value="time-savings" className="space-y-4">
            {/* Summary Stats */}
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

                {/* Pagination */}
                {timeStudies.pagination?.totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-white/10">
                    <p className="text-blue-300 text-sm">
                      Page {timeStudies.pagination.page} of {timeStudies.pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadTimeStudies(timeStudyPage - 1)}
                        disabled={timeStudyPage <= 1}
                        className="border-white/20 text-white"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadTimeStudies(timeStudyPage + 1)}
                        disabled={timeStudyPage >= timeStudies.pagination.totalPages}
                        className="border-white/20 text-white"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* User Details Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="sm:max-w-2xl bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              User Details
            </DialogTitle>
            <DialogDescription>View and manage user information</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-blue-300 text-sm">Name</p>
                  <p className="text-white">{selectedUser.name || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-blue-300 text-sm">Email</p>
                  <p className="text-white">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-blue-300 text-sm">Role</p>
                  <Badge variant="outline" className="border-blue-400 text-blue-300">
                    {selectedUser.role}
                  </Badge>
                </div>
                <div>
                  <p className="text-blue-300 text-sm">Total Sessions</p>
                  <p className="text-white">{selectedUser.companiesCount}</p>
                </div>
                <div>
                  <p className="text-blue-300 text-sm">Created</p>
                  <p className="text-white">{formatDate(selectedUser.createdAt)}</p>
                </div>
                <div>
                  <p className="text-blue-300 text-sm">Last Login</p>
                  <p className="text-white">{formatDate(selectedUser.lastLoginAt)}</p>
                </div>
              </div>

              {selectedUser.companies?.length > 0 && (
                <div>
                  <p className="text-blue-300 text-sm mb-2">Recent Sessions</p>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {selectedUser.companies.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10"
                          onClick={() => {
                            setSelectedUser(null);
                            viewCompanyDetails(c.id);
                          }}
                        >
                          <p className="text-white font-medium">{c.job_title}</p>
                          <p className="text-blue-300 text-sm">
                            {c.industry} • {formatDate(c.created_date)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
