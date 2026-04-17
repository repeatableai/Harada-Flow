import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Users,
  Briefcase,
  FolderTree,
  Loader2,
  Eye,
  FileText,
  Clock,
  Activity,
  Link,
  User,
  Mail,
  Lock,
  UserCog,
  Pause,
  Play,
  AlertTriangle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function CompanyManager() {
  const { isSuperAdmin } = useAuth();
  const [companies, setCompanies] = useState({ data: [], pagination: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    industry: '',
    companySize: '',
    website: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminJobTitle: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Employee details state
  const [companyUsers, setCompanyUsers] = useState({ data: [], pagination: {} });
  const [companyDepartments, setCompanyDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [departmentUsers, setDepartmentUsers] = useState([]);
  const [detailsView, setDetailsView] = useState('employees'); // 'employees' or 'departments'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeSessions, setEmployeeSessions] = useState([]);
  const [employeePrompts, setEmployeePrompts] = useState([]);
  const [loadingEmployeeData, setLoadingEmployeeData] = useState(false);

  // Inline department creation state
  const [showAddDeptDialog, setShowAddDeptDialog] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptAdminName, setNewDeptAdminName] = useState('');
  const [newDeptAdminEmail, setNewDeptAdminEmail] = useState('');
  const [newDeptAdminPassword, setNewDeptAdminPassword] = useState('');
  const [isCreatingDept, setIsCreatingDept] = useState(false);

  // Inline user invite state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteData, setInviteData] = useState({
    name: '', email: '', password: '', jobTitle: '', role: 'USER', departmentId: '',
  });
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    loadCompanies(1);
  }, []);

  const loadCompanies = async (pageNum, search = searchQuery) => {
    setIsLoading(true);
    try {
      const data = await apiClient.organizations.list({
        page: pageNum,
        limit: 10,
        search: search || undefined,
      });
      setCompanies(data);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCompanyUsers = async (companyId) => {
    try {
      const data = await apiClient.organizations.getUsers(companyId, { limit: 100 });
      setCompanyUsers(data);
    } catch (error) {
      console.error('Failed to load company users:', error);
    }
  };

  const loadCompanyDepartments = async (companyId) => {
    try {
      const data = await apiClient.departments.list(companyId, { limit: 100 });
      setCompanyDepartments(data.data || []);
    } catch (error) {
      console.error('Failed to load company departments:', error);
      setCompanyDepartments([]);
    }
  };

  const loadDepartmentUsers = async (deptId, companyId) => {
    setSelectedDepartment(deptId);
    try {
      // Filter users by department
      const allUsers = companyUsers.data || [];
      const deptUsers = allUsers.filter(u => u.department?.id === deptId);
      setDepartmentUsers(deptUsers);
    } catch (error) {
      console.error('Failed to load department users:', error);
      setDepartmentUsers([]);
    }
  };

  const loadEmployeeDetails = async (employee) => {
    setSelectedEmployee(employee);
    setLoadingEmployeeData(true);
    try {
      // Load employee's sessions (companies in the old model)
      const sessionsData = await apiClient.admin.getCompanies({ userId: employee.id, limit: 50 });
      setEmployeeSessions(sessionsData.data || []);

      // Load employee's saved prompts
      const promptsData = await apiClient.admin.getSavedPrompts({ limit: 100 });
      // Filter prompts by this user's sessions
      const userSessionIds = (sessionsData.data || []).map(s => s.id);
      const userPrompts = (promptsData.data || []).filter(p => userSessionIds.includes(p.company_id));
      setEmployeePrompts(userPrompts);
    } catch (error) {
      console.error('Failed to load employee details:', error);
    } finally {
      setLoadingEmployeeData(false);
    }
  };

  // Create department within current org
  const handleCreateDepartment = async () => {
    if (!newDeptName.trim() || !selectedCompany?.id) return;
    setIsCreatingDept(true);
    setError('');
    try {
      const deptData = { name: newDeptName.trim() };
      if (newDeptAdminEmail.trim()) {
        deptData.admin = {
          name: newDeptAdminName.trim(),
          email: newDeptAdminEmail.trim(),
          password: newDeptAdminPassword,
          jobTitle: '',
        };
      }
      await apiClient.departments.create(selectedCompany.id, deptData);
      setShowAddDeptDialog(false);
      setNewDeptName('');
      setNewDeptAdminName('');
      setNewDeptAdminEmail('');
      setNewDeptAdminPassword('');
      // Reload departments
      await loadCompanyDepartments(selectedCompany.id);
      await loadCompanyUsers(selectedCompany.id);
    } catch (err) {
      setError(err.message || 'Failed to create department');
    } finally {
      setIsCreatingDept(false);
    }
  };

  // Invite user to current org
  const handleInviteUser = async () => {
    if (!inviteData.name.trim() || !inviteData.email.trim() || !inviteData.password || !selectedCompany?.id) {
      setError('Name, email, and password are required');
      return;
    }
    if (inviteData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setIsInviting(true);
    setError('');
    try {
      await apiClient.admin.inviteUser({
        name: inviteData.name.trim(),
        email: inviteData.email.trim(),
        password: inviteData.password,
        jobTitle: inviteData.jobTitle.trim() || undefined,
        role: inviteData.role,
        organizationId: selectedCompany.id,
        departmentId: inviteData.departmentId || undefined,
      });
      setShowInviteDialog(false);
      setInviteData({ name: '', email: '', password: '', jobTitle: '', role: 'USER', departmentId: '' });
      // Reload users
      await loadCompanyUsers(selectedCompany.id);
    } catch (err) {
      setError(err.message || 'Failed to invite user');
    } finally {
      setIsInviting(false);
    }
  };

  const handleSearch = () => {
    loadCompanies(1, searchQuery);
  };

  const handleCreate = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      setError('Company name is required');
      return;
    }
    if (!formData.adminName.trim()) {
      setError('Admin name is required');
      return;
    }
    if (!formData.adminEmail.trim()) {
      setError('Admin email is required');
      return;
    }
    if (!formData.adminPassword.trim()) {
      setError('Admin password is required');
      return;
    }
    if (formData.adminPassword.length < 8) {
      setError('Admin password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.organizations.create({
        name: formData.name,
        url: formData.url || undefined,
        industry: formData.industry || undefined,
        companySize: formData.companySize || undefined,
        website: formData.website || undefined,
        admin: {
          name: formData.adminName,
          email: formData.adminEmail,
          password: formData.adminPassword,
          jobTitle: formData.adminJobTitle || undefined,
        },
      });
      setShowCreateDialog(false);
      setFormData({
        name: '',
        url: '',
        industry: '',
        companySize: '',
        website: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        adminJobTitle: '',
      });
      loadCompanies(1);
    } catch (error) {
      setError(error.message || 'Failed to create company');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!formData.name.trim()) {
      setError('Company name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.organizations.update(selectedCompany.id, {
        name: formData.name,
        industry: formData.industry || null,
        companySize: formData.companySize || null,
        website: formData.website || null,
      });
      setShowEditDialog(false);
      setSelectedCompany(null);
      setFormData({ name: '', industry: '', companySize: '', website: '' });
      loadCompanies(page);
    } catch (error) {
      setError(error.message || 'Failed to update company');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.organizations.delete(selectedCompany.id);
      setShowDeleteDialog(false);
      setSelectedCompany(null);
      loadCompanies(1);
    } catch (error) {
      setError(error.message || 'Failed to delete company');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openStatusDialog = (company) => {
    setSelectedCompany(company);
    setError('');
    setShowStatusDialog(true);
  };

  const handleToggleStatus = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.organizations.toggleStatus(selectedCompany.id, !selectedCompany.isActive);
      setShowStatusDialog(false);
      setSelectedCompany(null);
      loadCompanies(page);
    } catch (error) {
      setError(error.message || 'Failed to update company status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      industry: company.industry || '',
      companySize: company.companySize || '',
      website: company.website || '',
    });
    setError('');
    setShowEditDialog(true);
  };

  const openDeleteDialog = (company) => {
    setSelectedCompany(company);
    setError('');
    setShowDeleteDialog(true);
  };

  const openDetailsDialog = async (company) => {
    setSelectedCompany(company);
    setSelectedEmployee(null);
    setSelectedDepartment(null);
    setDepartmentUsers([]);
    setEmployeeSessions([]);
    setEmployeePrompts([]);
    setDetailsView('employees');
    await Promise.all([
      loadCompanyUsers(company.id),
      loadCompanyDepartments(company.id),
    ]);
    setShowDetailsDialog(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isSuperAdmin()) {
    return (
      <Card className="bg-white/10 border-white/20">
        <CardContent className="p-8 text-center">
          <p className="text-blue-300">Only Super Admins can manage companies.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" />
            Companies
          </h3>
          <p className="text-blue-300 text-sm">Manage companies and view employee details</p>
        </div>
        <Button
          onClick={() => {
            setFormData({
              name: '',
              url: '',
              industry: '',
              companySize: '',
              website: '',
              adminName: '',
              adminEmail: '',
              adminPassword: '',
              adminJobTitle: '',
            });
            setError('');
            setShowCreateDialog(true);
          }}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Company
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Search companies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="bg-white/10 border-white/20 text-white placeholder-blue-300"
        />
        <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Companies Table */}
      <Card className="bg-white/10 border-white/20">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-blue-200 font-medium">Company</th>
                    <th className="text-left p-4 text-blue-200 font-medium">Slug</th>
                    <th className="text-center p-4 text-blue-200 font-medium">Employees</th>
                    <th className="text-center p-4 text-blue-200 font-medium">Departments</th>
                    <th className="text-center p-4 text-blue-200 font-medium">Roles</th>
                    <th className="text-center p-4 text-blue-200 font-medium">Status</th>
                    <th className="text-left p-4 text-blue-200 font-medium">Created</th>
                    <th className="text-right p-4 text-blue-200 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.data?.map((company) => (
                    <tr key={company.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <p className="text-white font-medium">{company.name}</p>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="border-purple-400/50 text-purple-300 font-mono text-xs">
                          {company.slug}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <span className="flex items-center justify-center gap-1 text-blue-300">
                          <Users className="w-4 h-4" />
                          {company.usersCount}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="flex items-center justify-center gap-1 text-blue-300">
                          <FolderTree className="w-4 h-4" />
                          {company.departmentsCount}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="flex items-center justify-center gap-1 text-blue-300">
                          <Briefcase className="w-4 h-4" />
                          {company.companiesCount}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <Badge
                          variant="outline"
                          className={company.isActive !== false
                            ? 'border-green-400 text-green-300 bg-green-500/10'
                            : 'border-red-400 text-red-300 bg-red-500/10'
                          }
                        >
                          {company.isActive !== false ? 'Active' : 'Paused'}
                        </Badge>
                      </td>
                      <td className="p-4 text-blue-300 text-sm">
                        {formatDate(company.createdAt)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDetailsDialog(company)}
                            className="text-green-300 hover:text-white hover:bg-white/10"
                            title="View Employees"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(company)}
                            className="text-blue-300 hover:text-white hover:bg-white/10"
                            title="Edit Company"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openStatusDialog(company)}
                            className={company.isActive !== false
                              ? 'text-orange-300 hover:text-white hover:bg-orange-500/10'
                              : 'text-green-300 hover:text-white hover:bg-green-500/10'
                            }
                            title={company.isActive !== false ? 'Pause Company' : 'Activate Company'}
                          >
                            {company.isActive !== false ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDeleteDialog(company)}
                            className="text-red-300 hover:text-red-200 hover:bg-red-500/10"
                            disabled={company.usersCount > 0}
                            title="Delete Company"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!companies.data || companies.data.length === 0) && (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-blue-300">
                        No companies found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {companies.pagination?.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-white/10">
              <p className="text-blue-300 text-sm">
                Page {companies.pagination.page} of {companies.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadCompanies(page - 1)}
                  disabled={page <= 1}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadCompanies(page + 1)}
                  disabled={page >= companies.pagination.totalPages}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Company</DialogTitle>
            <DialogDescription>Add a new company and designate its administrator.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                  {error}
                </div>
              )}

              {/* Company Information */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-purple-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Company Information
                </h4>
                <div className="space-y-2">
                  <Label className="text-white">Company Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter company name"
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Link className="w-4 h-4 text-blue-400" />
                    Company URL (Legacy)
                  </Label>
                  <Input
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://example.com"
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                  />
                </div>
              </div>

              {/* Company Profile Information - for form pre-fill */}
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-sm font-medium text-green-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Company Profile (Pre-fills user forms)
                </h4>
                <p className="text-blue-300/70 text-xs mt-1 mb-3">
                  This information will be pre-filled for users when they create deliverables
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-white">Industry</Label>
                  <Input
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    placeholder="e.g., Technology, Healthcare, Finance"
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Company Size</Label>
                  <Select
                    value={formData.companySize}
                    onValueChange={(value) => setFormData({ ...formData, companySize: value })}
                  >
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
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Link className="w-4 h-4 text-blue-400" />
                    Company Website
                  </Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://company.com"
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-sm font-medium text-blue-300 flex items-center gap-2">
                  <UserCog className="w-4 h-4" />
                  Company Administrator
                </h4>
              </div>

              {/* Admin Information */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400" />
                    Admin Name *
                  </Label>
                  <Input
                    value={formData.adminName}
                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                    placeholder="John Smith"
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-400" />
                    Admin Email *
                  </Label>
                  <Input
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    placeholder="admin@company.com"
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-400" />
                    Admin Password *
                  </Label>
                  <Input
                    type="password"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    placeholder="Minimum 8 characters"
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-400" />
                    Admin Job Title
                  </Label>
                  <Input
                    value={formData.adminJobTitle}
                    onChange={(e) => setFormData({ ...formData, adminJobTitle: e.target.value })}
                    placeholder="e.g., Operations Manager"
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setShowCreateDialog(false)}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Company'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>Update company details and profile information.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-white">Company Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter company name"
                  className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                />
              </div>

              {/* Company Profile Information */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h4 className="text-sm font-medium text-green-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Company Profile (Pre-fills user forms)
                </h4>
                <p className="text-blue-300/70 text-xs mt-1 mb-3">
                  This information will be pre-filled for users when they create deliverables
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Industry</Label>
                <Input
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="e.g., Technology, Healthcare, Finance"
                  className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Company Size</Label>
                <Select
                  value={formData.companySize}
                  onValueChange={(value) => setFormData({ ...formData, companySize: value })}
                >
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
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Link className="w-4 h-4 text-blue-400" />
                  Company Website
                </Label>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://company.com"
                  className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setShowEditDialog(false)}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Delete Company</DialogTitle>
            <DialogDescription>Are you sure you want to delete this company?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
            {selectedCompany && (
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-white font-medium">{selectedCompany.name}</p>
                <p className="text-blue-300 text-sm">
                  {selectedCompany.usersCount} employees, {selectedCompany.departmentsCount} departments
                </p>
              </div>
            )}
            {selectedCompany?.usersCount > 0 && (
              <p className="text-yellow-400 text-sm">
                Cannot delete company with employees. Reassign employees first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowDeleteDialog(false)}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isSubmitting || selectedCompany?.usersCount > 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Company Details Dialog - Employee View */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              {selectedCompany?.name}
            </DialogTitle>
            <DialogDescription>
              View employees and departments
            </DialogDescription>
          </DialogHeader>

          {/* View Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDetailsView('employees');
                setSelectedDepartment(null);
                setDepartmentUsers([]);
              }}
              className={detailsView === 'employees'
                ? 'bg-purple-600 text-white hover:bg-purple-700 hover:text-white'
                : 'bg-white/10 text-blue-300 border border-white/20 hover:bg-white/20 hover:text-white'
              }
            >
              <Users className="w-4 h-4 mr-2" />
              All Employees ({companyUsers.data?.length || 0})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDetailsView('departments');
                setSelectedEmployee(null);
              }}
              className={detailsView === 'departments'
                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:text-white'
                : 'bg-white/10 text-blue-300 border border-white/20 hover:bg-white/20 hover:text-white'
              }
            >
              <FolderTree className="w-4 h-4 mr-2" />
              By Department ({companyDepartments.length})
            </Button>
            <div className="flex-1" />
            <Button
              size="sm"
              onClick={() => setShowAddDeptDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FolderTree className="w-4 h-4 mr-1" />
              Add Department
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setInviteData({ name: '', email: '', password: '', jobTitle: '', role: 'USER', departmentId: '' });
                setShowInviteDialog(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Invite User
            </Button>
          </div>

          <div className="flex gap-4 h-[55vh]">
            {/* Left Panel - Employee/Department List */}
            <div className="w-1/3 border-r border-white/10 pr-4">
              {detailsView === 'employees' ? (
                <>
                  <h4 className="text-sm font-medium text-blue-200 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    All Employees
                  </h4>
                  <ScrollArea className="h-[calc(100%-2rem)]">
                    <div className="space-y-2">
                      {companyUsers.data?.map((employee) => (
                        <div
                          key={employee.id}
                          onClick={() => loadEmployeeDetails(employee)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedEmployee?.id === employee.id
                              ? 'bg-purple-500/20 border border-purple-500/50'
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <p className="text-white font-medium text-sm">{employee.name || 'Unknown'}</p>
                          <p className="text-blue-300 text-xs">{employee.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs border-blue-400/50 text-blue-300">
                              {employee.role}
                            </Badge>
                            {employee.department && (
                              <span className="text-xs text-blue-300/70">{employee.department.name}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!companyUsers.data || companyUsers.data.length === 0) && (
                        <p className="text-blue-300/50 text-sm text-center py-4">No employees</p>
                      )}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-blue-200 flex items-center gap-2">
                      <FolderTree className="w-4 h-4" />
                      Departments
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowAddDeptDialog(true)}
                      className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-6 px-2 text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  <ScrollArea className="h-[calc(100%-2rem)]">
                    <div className="space-y-2">
                      {/* Unassigned employees section */}
                      {(() => {
                        const unassignedCount = (companyUsers.data || []).filter(u => !u.department).length;
                        if (unassignedCount > 0) {
                          return (
                            <div
                              onClick={() => {
                                setSelectedDepartment('unassigned');
                                setDepartmentUsers((companyUsers.data || []).filter(u => !u.department));
                                setSelectedEmployee(null);
                              }}
                              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                                selectedDepartment === 'unassigned'
                                  ? 'bg-orange-500/20 border border-orange-500/50'
                                  : 'bg-white/5 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-orange-300 font-medium text-sm">Unassigned</p>
                                <Badge variant="outline" className="text-xs border-orange-400/50 text-orange-300">
                                  {unassignedCount}
                                </Badge>
                              </div>
                              <p className="text-blue-300/70 text-xs mt-1">Employees without a department</p>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Department list */}
                      {companyDepartments.map((dept) => {
                        const deptUserCount = (companyUsers.data || []).filter(u => u.department?.id === dept.id).length;
                        return (
                          <div
                            key={dept.id}
                            onClick={() => {
                              loadDepartmentUsers(dept.id, selectedCompany?.id);
                              setSelectedEmployee(null);
                            }}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              selectedDepartment === dept.id
                                ? 'bg-blue-500/20 border border-blue-500/50'
                                : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-white font-medium text-sm">{dept.name}</p>
                              <Badge variant="outline" className="text-xs border-blue-400/50 text-blue-300">
                                {deptUserCount}
                              </Badge>
                            </div>
                            <p className="text-blue-300/70 text-xs mt-1">
                              {deptUserCount === 1 ? '1 employee' : `${deptUserCount} employees`}
                            </p>
                          </div>
                        );
                      })}
                      {companyDepartments.length === 0 && (
                        <p className="text-blue-300/50 text-sm text-center py-4">No departments</p>
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>

            {/* Middle Panel - Department Employees (only in departments view) */}
            {detailsView === 'departments' && selectedDepartment && (
              <div className="w-1/3 border-r border-white/10 pr-4">
                <h4 className="text-sm font-medium text-blue-200 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {selectedDepartment === 'unassigned' ? 'Unassigned' : companyDepartments.find(d => d.id === selectedDepartment)?.name} ({departmentUsers.length})
                </h4>
                <ScrollArea className="h-[calc(100%-2rem)]">
                  <div className="space-y-2">
                    {departmentUsers.map((employee) => (
                      <div
                        key={employee.id}
                        onClick={() => loadEmployeeDetails(employee)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedEmployee?.id === employee.id
                            ? 'bg-purple-500/20 border border-purple-500/50'
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <p className="text-white font-medium text-sm">{employee.name || 'Unknown'}</p>
                        <p className="text-blue-300 text-xs">{employee.email}</p>
                        <Badge variant="outline" className="text-xs border-blue-400/50 text-blue-300 mt-1">
                          {employee.role}
                        </Badge>
                      </div>
                    ))}
                    {departmentUsers.length === 0 && (
                      <p className="text-blue-300/50 text-sm text-center py-4">No employees in this department</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Employee Details */}
            <div className="flex-1 pl-4">
              {selectedEmployee ? (
                loadingEmployeeData ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  </div>
                ) : (
                  <Tabs defaultValue="sessions" className="h-full flex flex-col">
                    <div className="mb-4">
                      <h4 className="text-white font-medium">{selectedEmployee.name || selectedEmployee.email}</h4>
                      <p className="text-blue-300 text-sm">{selectedEmployee.email}</p>
                      <p className="text-blue-300/70 text-xs mt-1">
                        Last login: {formatDateTime(selectedEmployee.lastLoginAt)}
                      </p>
                    </div>

                    <TabsList className="bg-white/10 border border-white/20 mb-4">
                      <TabsTrigger value="sessions" className="data-[state=active]:bg-white/20 text-white">
                        <Briefcase className="w-4 h-4 mr-2" />
                        Roles ({employeeSessions.length})
                      </TabsTrigger>
                      <TabsTrigger value="prompts" className="data-[state=active]:bg-white/20 text-white">
                        <FileText className="w-4 h-4 mr-2" />
                        Prompts ({employeePrompts.length})
                      </TabsTrigger>
                      <TabsTrigger value="activity" className="data-[state=active]:bg-white/20 text-white">
                        <Activity className="w-4 h-4 mr-2" />
                        Activity
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="sessions" className="flex-1 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="space-y-2">
                          {employeeSessions.map((session) => (
                            <div key={session.id} className="p-3 bg-white/5 rounded-lg">
                              <p className="text-white font-medium text-sm">{session.job_title}</p>
                              <p className="text-blue-300 text-xs">{session.industry} - {session.company_size}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-blue-300/70">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(session.created_date)}
                                </span>
                                {session.productivity_matrix && (
                                  <Badge variant="outline" className="text-xs border-green-400/50 text-green-300">
                                    Productivity
                                  </Badge>
                                )}
                                {session.performance_matrix && (
                                  <Badge variant="outline" className="text-xs border-blue-400/50 text-blue-300">
                                    Performance
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                          {employeeSessions.length === 0 && (
                            <p className="text-blue-300/50 text-sm text-center py-4">No roles</p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="prompts" className="flex-1 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="space-y-2">
                          {employeePrompts.map((prompt) => (
                            <div key={prompt.id} className="p-3 bg-white/5 rounded-lg">
                              <p className="text-white font-medium text-sm">{prompt.deliverable_name}</p>
                              <p className="text-blue-300 text-xs truncate">{prompt.overview?.substring(0, 100)}...</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    prompt.deliverable_type === 'productivity'
                                      ? 'border-green-400/50 text-green-300'
                                      : 'border-blue-400/50 text-blue-300'
                                  }`}
                                >
                                  {prompt.deliverable_type}
                                </Badge>
                                <span className="text-xs text-blue-300/70">
                                  {formatDate(prompt.created_at)}
                                </span>
                              </div>
                            </div>
                          ))}
                          {employeePrompts.length === 0 && (
                            <p className="text-blue-300/50 text-sm text-center py-4">No saved prompts</p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="activity" className="flex-1 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 rounded-lg">
                              <p className="text-blue-300 text-xs">Total Roles</p>
                              <p className="text-2xl font-bold text-white">{employeeSessions.length}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                              <p className="text-blue-300 text-xs">Saved Prompts</p>
                              <p className="text-2xl font-bold text-white">{employeePrompts.length}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                              <p className="text-blue-300 text-xs">Account Created</p>
                              <p className="text-sm text-white">{formatDate(selectedEmployee.createdAt)}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                              <p className="text-blue-300 text-xs">Last Active</p>
                              <p className="text-sm text-white">{formatDateTime(selectedEmployee.lastLoginAt)}</p>
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                )
              ) : (
                <div className="flex items-center justify-center h-full text-blue-300/50 text-center">
                  {detailsView === 'departments' && !selectedDepartment ? (
                    <div>
                      <FolderTree className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Select a department to view its employees</p>
                    </div>
                  ) : detailsView === 'departments' && selectedDepartment && departmentUsers.length === 0 ? (
                    <div>
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No employees in this department</p>
                    </div>
                  ) : (
                    <div>
                      <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Select an employee to view details</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pause/Activate Company Confirmation */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              {selectedCompany?.isActive !== false ? (
                <>
                  <Pause className="w-5 h-5 text-orange-400" />
                  Pause Company
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 text-green-400" />
                  Activate Company
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300">
              {selectedCompany?.isActive !== false ? (
                <>
                  Are you sure you want to pause <span className="text-white font-medium">{selectedCompany?.name}</span>?
                  <br /><br />
                  <span className="text-orange-300">This will also pause all {selectedCompany?.usersCount || 0} employees in this company.</span>
                  {' '}They will be logged out and unable to access the system until the company is reactivated.
                </>
              ) : (
                <>
                  Are you sure you want to reactivate <span className="text-white font-medium">{selectedCompany?.name}</span>?
                  <br /><br />
                  <span className="text-green-300">This will also reactivate all {selectedCompany?.usersCount || 0} employees in this company.</span>
                  {' '}They will be able to log in and access the system again.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleStatus}
              disabled={isSubmitting}
              className={selectedCompany?.isActive !== false
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-green-600 text-white hover:bg-green-700'
              }
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : selectedCompany?.isActive !== false ? (
                'Pause Company'
              ) : (
                'Activate Company'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Department Dialog */}
      <Dialog open={showAddDeptDialog} onOpenChange={setShowAddDeptDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-green-400" />
              Add Department to {selectedCompany?.name}
            </DialogTitle>
            <DialogDescription>Create a new department. Optionally assign a department admin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-blue-200">Department Name *</Label>
              <Input
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                placeholder="e.g., Engineering, Operations"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div className="border-t border-white/10 pt-3">
              <p className="text-blue-200/70 text-xs mb-3">Optional: Create a department admin</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-blue-200 text-sm">Admin Name</Label>
                  <Input
                    value={newDeptAdminName}
                    onChange={e => setNewDeptAdminName(e.target.value)}
                    placeholder="Full name"
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
                <div>
                  <Label className="text-blue-200 text-sm">Admin Email</Label>
                  <Input
                    type="email"
                    value={newDeptAdminEmail}
                    onChange={e => setNewDeptAdminEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
                <div>
                  <Label className="text-blue-200 text-sm">Admin Password</Label>
                  <Input
                    type="password"
                    value={newDeptAdminPassword}
                    onChange={e => setNewDeptAdminPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddDeptDialog(false)} className="text-white">Cancel</Button>
            <Button
              onClick={handleCreateDepartment}
              disabled={isCreatingDept || !newDeptName.trim()}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isCreatingDept ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-green-400" />
              Invite User to {selectedCompany?.name}
            </DialogTitle>
            <DialogDescription>Create a new user account for this company.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-blue-200">Full Name *</Label>
              <Input
                value={inviteData.name}
                onChange={e => setInviteData({ ...inviteData, name: e.target.value })}
                placeholder="First and last name"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-blue-200">Email *</Label>
              <Input
                type="email"
                value={inviteData.email}
                onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                placeholder="user@company.com"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-blue-200">Password *</Label>
              <Input
                type="password"
                value={inviteData.password}
                onChange={e => setInviteData({ ...inviteData, password: e.target.value })}
                placeholder="Min 8 characters"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-blue-200">Job Title</Label>
              <Input
                value={inviteData.jobTitle}
                onChange={e => setInviteData({ ...inviteData, jobTitle: e.target.value })}
                placeholder="e.g., VP of Operations"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-blue-200">Role</Label>
              <Select value={inviteData.role} onValueChange={v => setInviteData({ ...inviteData, role: v })}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="DEPARTMENT_ADMIN">Department Admin</SelectItem>
                  <SelectItem value="COMPANY_ADMIN">Company Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-blue-200">Department</Label>
              <Select value={inviteData.departmentId || 'none'} onValueChange={v => setInviteData({ ...inviteData, departmentId: v === 'none' ? '' : v })}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select department (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {companyDepartments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowInviteDialog(false)} className="text-white">Cancel</Button>
            <Button
              onClick={handleInviteUser}
              disabled={isInviting || !inviteData.name.trim() || !inviteData.email.trim() || !inviteData.password}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isInviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Invite User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
