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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Edit,
  Building2,
  FolderTree,
  Shield,
  Loader2,
  Mail,
  Eye,
  User,
  Briefcase,
  FileText,
  Clock,
  Activity,
  Trash2,
  Pause,
  Play,
  AlertTriangle,
  ArrowUpDown,
  Filter,
  Lock,
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

const ROLE_OPTIONS = [
  { value: 'USER', label: 'User', description: 'Regular user access' },
  { value: 'DEPARTMENT_ADMIN', label: 'Department Admin', description: 'Manage department users' },
  { value: 'COMPANY_ADMIN', label: 'Company Admin', description: 'Manage company' },
  { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full system access' },
];

const ROLE_COLORS = {
  USER: 'border-gray-400 text-gray-300',
  DEPARTMENT_ADMIN: 'border-green-400 text-green-300',
  COMPANY_ADMIN: 'border-blue-400 text-blue-300',
  ADMIN: 'border-blue-400 text-blue-300',
  SUPER_ADMIN: 'border-purple-400 text-purple-300',
};

export default function UserManager() {
  const { user, isAdmin, isCompanyAdmin, isSuperAdmin, organization, department, canManage } = useAuth();

  // Department Admin is someone who is admin but NOT company admin (or higher)
  const isDeptAdmin = isAdmin() && !isCompanyAdmin();
  const [users, setUsers] = useState({ data: [], pagination: {} });
  const [organizations, setOrganizations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filterDepartments, setFilterDepartments] = useState([]); // Departments for the filter dropdown
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);

  // Filter and sort state
  const [sortBy, setSortBy] = useState('-createdAt');
  const [roleFilter, setRoleFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Employee details state
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [employeeSessions, setEmployeeSessions] = useState([]);
  const [employeePrompts, setEmployeePrompts] = useState([]);
  const [loadingEmployeeData, setLoadingEmployeeData] = useState(false);

  // Dialogs
  const [showEditRoleDialog, setShowEditRoleDialog] = useState(false);
  const [showEditOrgDialog, setShowEditOrgDialog] = useState(false);
  const [showEditDeptDialog, setShowEditDeptDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    jobTitle: '',
    role: '',
    organizationId: '',
    departmentId: '',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    jobTitle: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [departmentSearchText, setDepartmentSearchText] = useState('');
  const [showDeptSuggestions, setShowDeptSuggestions] = useState(false);

  useEffect(() => {
    loadUsers(1);
    if (isSuperAdmin()) {
      loadOrganizations();
    }
  }, []);

  // Load departments for Company Admins when organization becomes available
  useEffect(() => {
    if (!isSuperAdmin() && isCompanyAdmin() && organization?.id) {
      loadDepartments(organization.id);
    }
  }, [organization?.id]);

  useEffect(() => {
    // Load departments when organization changes (for Super Admins in filter)
    if (isSuperAdmin() && formData.organizationId) {
      loadDepartments(formData.organizationId);
    }
  }, [formData.organizationId]);

  const loadUsers = async (
    pageNum,
    search = searchQuery,
    sort = sortBy,
    role = roleFilter,
    org = orgFilter,
    dept = deptFilter,
    status = statusFilter
  ) => {
    setIsLoading(true);
    try {
      const data = await apiClient.admin.getUsers({
        page: pageNum,
        limit: 10,
        search: search || undefined,
        sort,
        role: role || undefined,
        organizationId: org || undefined,
        departmentId: dept || undefined,
        isActive: status || undefined,
      });
      setUsers(data);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const data = await apiClient.organizations.list({ limit: 100 });
      setOrganizations(data.data || []);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    }
  };

  const loadDepartments = async (orgId) => {
    if (!orgId) {
      setDepartments([]);
      return;
    }
    try {
      const data = await apiClient.departments.list(orgId, { limit: 100 });
      setDepartments(data.data || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
      setDepartments([]);
    }
  };

  const loadEmployeeDetails = async (employee) => {
    setSelectedUser(employee);
    setShowDetailsDialog(true);
    setLoadingEmployeeData(true);
    try {
      // Load employee's sessions
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

  const handleSearch = () => {
    loadUsers(1, searchQuery, sortBy, roleFilter, orgFilter, deptFilter, statusFilter);
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    loadUsers(1, searchQuery, newSort, roleFilter, orgFilter, deptFilter, statusFilter);
  };

  const handleRoleFilterChange = (newRole) => {
    setRoleFilter(newRole);
    loadUsers(1, searchQuery, sortBy, newRole, orgFilter, deptFilter, statusFilter);
  };

  const handleOrgFilterChange = async (newOrg) => {
    setOrgFilter(newOrg);
    setDeptFilter(''); // Reset department filter when org changes
    if (newOrg) {
      // Load departments for the selected org
      try {
        const data = await apiClient.departments.list(newOrg, { limit: 100 });
        setFilterDepartments(data.data || []);
      } catch (error) {
        console.error('Failed to load departments for filter:', error);
        setFilterDepartments([]);
      }
    } else {
      setFilterDepartments([]);
    }
    loadUsers(1, searchQuery, sortBy, roleFilter, newOrg, '', statusFilter);
  };

  const handleDeptFilterChange = (newDept) => {
    setDeptFilter(newDept);
    loadUsers(1, searchQuery, sortBy, roleFilter, orgFilter, newDept, statusFilter);
  };

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    loadUsers(1, searchQuery, sortBy, roleFilter, orgFilter, deptFilter, newStatus);
  };

  const handleUpdateRole = async () => {
    if (!formData.role) {
      setError('Role is required');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.admin.updateUserRole(selectedUser.id, formData.role);
      setShowEditRoleDialog(false);
      setSelectedUser(null);
      loadUsers(page, searchQuery, sortBy, roleFilter, orgFilter, deptFilter, statusFilter);
    } catch (error) {
      setError(error.message || 'Failed to update role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrganization = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.admin.updateUserOrganization(selectedUser.id, formData.organizationId || null);
      setShowEditOrgDialog(false);
      setSelectedUser(null);
      loadUsers(page, searchQuery, sortBy, roleFilter, orgFilter, deptFilter, statusFilter);
    } catch (error) {
      setError(error.message || 'Failed to update organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDepartment = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.admin.updateUserDepartment(selectedUser.id, formData.departmentId || null);
      setShowEditDeptDialog(false);
      setSelectedUser(null);
      loadUsers(page, searchQuery, sortBy, roleFilter, orgFilter, deptFilter, statusFilter);
    } catch (error) {
      setError(error.message || 'Failed to update department');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteUser = async () => {
    // Validate required fields
    if (!formData.firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!formData.lastName.trim()) {
      setError('Last name is required');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!formData.password.trim()) {
      setError('Password is required');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    // Department is required for Company Admins (they select), but auto-filled for Dept Admins
    if (!isDeptAdmin && !formData.departmentId) {
      setError('Department is required');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      // For Dept Admins, use their own department; for others, use selected department
      const targetDepartmentId = isDeptAdmin ? department?.id : formData.departmentId;

      await apiClient.admin.inviteUser({
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        jobTitle: formData.jobTitle?.trim() || undefined,
        organizationId: formData.organizationId || organization?.id || undefined,
        departmentId: targetDepartmentId,
        role: isDeptAdmin ? 'USER' : (formData.role || 'USER'), // Dept Admins can only create USERs
      });
      setShowInviteDialog(false);
      resetFormData();
      loadUsers(1, '', sortBy, roleFilter, orgFilter, deptFilter, statusFilter);
    } catch (error) {
      setError(error.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFormData = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      jobTitle: '',
      role: 'USER',
      organizationId: organization?.id || '',
      departmentId: '',
    });
    setDepartmentSearchText('');
    setShowDeptSuggestions(false);
  };

  const openEditRoleDialog = (usr) => {
    setSelectedUser(usr);
    setFormData({ ...formData, role: usr.role });
    setError('');
    setShowEditRoleDialog(true);
  };

  const openEditOrgDialog = (usr) => {
    setSelectedUser(usr);
    setFormData({ ...formData, organizationId: usr.organizationId || '' });
    setError('');
    setShowEditOrgDialog(true);
  };

  const openEditDeptDialog = (usr) => {
    setSelectedUser(usr);
    // Load departments for the user's org
    if (usr.organizationId) {
      loadDepartments(usr.organizationId);
    }
    setFormData({ ...formData, departmentId: usr.departmentId || '' });
    setError('');
    setShowEditDeptDialog(true);
  };

  const openInviteDialog = () => {
    resetFormData();
    setError('');
    setShowInviteDialog(true);
  };

  const openEditUserDialog = (usr) => {
    setSelectedUser(usr);
    setEditFormData({
      name: usr.name || '',
      email: usr.email || '',
      jobTitle: usr.job_title || '',
    });
    setError('');
    setShowEditUserDialog(true);
  };

  const openDeleteDialog = (usr) => {
    setSelectedUser(usr);
    setError('');
    setShowDeleteDialog(true);
  };

  const openStatusDialog = (usr) => {
    setSelectedUser(usr);
    setError('');
    setShowStatusDialog(true);
  };

  const handleUpdateUser = async () => {
    if (!editFormData.name?.trim()) {
      setError('Name is required');
      return;
    }
    if (!editFormData.email?.trim()) {
      setError('Email is required');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.admin.updateUser(selectedUser.id, {
        name: editFormData.name.trim(),
        email: editFormData.email.trim().toLowerCase(),
        jobTitle: editFormData.jobTitle?.trim() || null,
      });
      setShowEditUserDialog(false);
      setSelectedUser(null);
      loadUsers(page, searchQuery, sortBy, roleFilter, orgFilter, deptFilter, statusFilter);
    } catch (error) {
      setError(error.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      // Use GDPR-compliant erasure endpoint instead of basic delete
      // This deletes stored files, anonymizes activity logs, and creates an audit trail
      await apiClient.admin.eraseUserData(selectedUser.id);
      setShowDeleteDialog(false);
      setSelectedUser(null);
      loadUsers(1, searchQuery, sortBy, roleFilter, orgFilter, deptFilter, statusFilter);
    } catch (error) {
      setError(error.message || 'Failed to erase user data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.admin.toggleUserStatus(selectedUser.id, !selectedUser.isActive);
      setShowStatusDialog(false);
      setSelectedUser(null);
      loadUsers(page, searchQuery, sortBy, roleFilter, orgFilter, deptFilter, statusFilter);
    } catch (error) {
      setError(error.message || 'Failed to update user status');
    } finally {
      setIsSubmitting(false);
    }
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

  // Get available roles based on current user's role
  const getAvailableRoles = () => {
    if (isSuperAdmin()) {
      return ROLE_OPTIONS;
    }
    if (isCompanyAdmin()) {
      return ROLE_OPTIONS.filter(r => r.value !== 'SUPER_ADMIN' && r.value !== 'COMPANY_ADMIN');
    }
    return ROLE_OPTIONS.filter(r => r.value === 'USER');
  };

  if (!isAdmin()) {
    return (
      <Card className="bg-white/10 border-white/20">
        <CardContent className="p-8 text-center">
          <p className="text-blue-300">Admin access required to manage users.</p>
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
            <Users className="w-5 h-5 text-blue-400" />
            {isSuperAdmin() ? 'User Management' : isDeptAdmin ? 'Team Members' : 'Employee Management'}
          </h3>
          <p className="text-blue-300 text-sm">
            {isSuperAdmin()
              ? 'Manage user roles and assignments'
              : isDeptAdmin
                ? `Manage team members in ${department?.name || 'your department'}`
                : `Manage employees in ${organization?.name || 'your company'}`}
          </p>
        </div>
        <Button
          onClick={openInviteDialog}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          {isSuperAdmin() ? 'Invite User' : isDeptAdmin ? 'Add Team Member' : 'Add Employee'}
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search by email or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="bg-white/10 border-white/20 text-white placeholder-blue-300 flex-1 min-w-[200px]"
        />
        {/* Role Filter */}
        <Select value={roleFilter || '__all__'} onValueChange={(val) => handleRoleFilterChange(val === '__all__' ? '' : val)}>
          <SelectTrigger className="w-[160px] bg-white/10 border-white/20 text-white">
            <Shield className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Roles</SelectItem>
            {getAvailableRoles().map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Organization Filter (Super Admin only) */}
        {isSuperAdmin() && (
          <Select value={orgFilter || '__all__'} onValueChange={(val) => handleOrgFilterChange(val === '__all__' ? '' : val)}>
            <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white">
              <Building2 className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Companies</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* Department Filter */}
        {(isSuperAdmin() || isCompanyAdmin()) && (
          <Select value={deptFilter || '__all__'} onValueChange={(val) => handleDeptFilterChange(val === '__all__' ? '' : val)}>
            <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white">
              <FolderTree className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Departments</SelectItem>
              {(isSuperAdmin() ? filterDepartments : departments).map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* Status Filter */}
        <Select value={statusFilter || '__all__'} onValueChange={(val) => handleStatusFilterChange(val === '__all__' ? '' : val)}>
          <SelectTrigger className="w-[140px] bg-white/10 border-white/20 text-white">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Paused</SelectItem>
          </SelectContent>
        </Select>
        {/* Sort */}
        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white">
            <ArrowUpDown className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-createdAt">Newest First</SelectItem>
            <SelectItem value="createdAt">Oldest First</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="-name">Name Z-A</SelectItem>
            <SelectItem value="email">Email A-Z</SelectItem>
            <SelectItem value="-email">Email Z-A</SelectItem>
            <SelectItem value="role">Role A-Z</SelectItem>
            <SelectItem value="-role">Role Z-A</SelectItem>
            <SelectItem value="department">Department A-Z</SelectItem>
            <SelectItem value="-department">Department Z-A</SelectItem>
            <SelectItem value="-lastLoginAt">Recent Login First</SelectItem>
            <SelectItem value="lastLoginAt">Oldest Login First</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Users Table */}
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
                    <th className="text-left p-4 text-blue-200 font-medium">User</th>
                    <th className="text-left p-4 text-blue-200 font-medium">Role</th>
                    <th className="text-center p-4 text-blue-200 font-medium">Status</th>
                    {isSuperAdmin() && (
                      <th className="text-left p-4 text-blue-200 font-medium">Company</th>
                    )}
                    <th className="text-left p-4 text-blue-200 font-medium">Department</th>
                    <th className="text-left p-4 text-blue-200 font-medium">Last Login</th>
                    <th className="text-right p-4 text-blue-200 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data?.map((usr) => (
                    <tr key={usr.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{usr.name || 'Unknown'}</p>
                          <p className="text-blue-300 text-sm">{usr.email}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={ROLE_COLORS[usr.role] || ROLE_COLORS.USER}>
                          {usr.role}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge
                          variant="outline"
                          className={usr.isActive !== false
                            ? 'border-green-400 text-green-300 bg-green-500/10'
                            : 'border-red-400 text-red-300 bg-red-500/10'
                          }
                        >
                          {usr.isActive !== false ? 'Active' : 'Paused'}
                        </Badge>
                      </td>
                      {isSuperAdmin() && (
                        <td className="p-4">
                          {usr.organization ? (
                            <span className="text-white text-sm">{usr.organization.name}</span>
                          ) : (
                            <span className="text-blue-300/50 text-sm">-</span>
                          )}
                        </td>
                      )}
                      <td className="p-4">
                        {usr.department ? (
                          <span className="text-white text-sm">{usr.department.name}</span>
                        ) : (
                          <span className="text-blue-300/50 text-sm">-</span>
                        )}
                      </td>
                      <td className="p-4 text-blue-300 text-sm">
                        {formatDate(usr.lastLoginAt)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Details Button - for all Admins */}
                          {isAdmin() && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => loadEmployeeDetails(usr)}
                              className="text-cyan-300 hover:text-white hover:bg-white/10"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          {/* Edit User Button */}
                          {canManage(usr.role) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditUserDialog(usr)}
                              className="text-yellow-300 hover:text-white hover:bg-white/10"
                              title="Edit User"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {canManage(usr.role) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditRoleDialog(usr)}
                              className="text-blue-300 hover:text-white hover:bg-white/10"
                              title="Change Role"
                            >
                              <Shield className="w-4 h-4" />
                            </Button>
                          )}
                          {/* Pause/Activate Button */}
                          {canManage(usr.role) && usr.id !== user.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openStatusDialog(usr)}
                              className={usr.isActive !== false
                                ? 'text-orange-300 hover:text-white hover:bg-orange-500/10'
                                : 'text-green-300 hover:text-white hover:bg-green-500/10'
                              }
                              title={usr.isActive !== false ? 'Pause Account' : 'Activate Account'}
                            >
                              {usr.isActive !== false ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </Button>
                          )}
                          {/* GDPR Erase Button */}
                          {canManage(usr.role) && usr.id !== user.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openDeleteDialog(usr)}
                              className="text-red-300 hover:text-white hover:bg-red-500/10"
                              title="Erase User Data (GDPR)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!users.data || users.data.length === 0) && (
                    <tr>
                      <td colSpan={isSuperAdmin() ? 7 : 6} className="p-8 text-center text-blue-300">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {users.pagination?.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-white/10">
              <p className="text-blue-300 text-sm">
                Page {users.pagination.page} of {users.pagination.totalPages}
                {users.pagination.total && ` (${users.pagination.total} total)`}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadUsers(page - 1, searchQuery, sortBy, roleFilter, orgFilter, deptFilter, statusFilter)}
                  disabled={page <= 1}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadUsers(page + 1, searchQuery, sortBy, roleFilter, orgFilter, deptFilter, statusFilter)}
                  disabled={page >= users.pagination.totalPages}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              {selectedUser?.name || selectedUser?.email} - Details
            </DialogTitle>
            <DialogDescription>
              View employee sessions, saved prompts, and activity
            </DialogDescription>
          </DialogHeader>

          {loadingEmployeeData ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : selectedUser && (
            <div className="space-y-4">
              {/* Employee Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="text-blue-300 text-xs">Email</p>
                  <p className="text-white text-sm">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-blue-300 text-xs">Role</p>
                  <Badge variant="outline" className={`${ROLE_COLORS[selectedUser.role]} text-xs`}>
                    {selectedUser.role}
                  </Badge>
                </div>
                <div>
                  <p className="text-blue-300 text-xs">Department</p>
                  <p className="text-white text-sm">{selectedUser.department?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-blue-300 text-xs">Last Login</p>
                  <p className="text-white text-sm">{formatDateTime(selectedUser.lastLoginAt)}</p>
                </div>
              </div>

              <Tabs defaultValue="sessions" className="w-full">
                <TabsList className="bg-white/10 border border-white/20">
                  <TabsTrigger value="sessions" className="data-[state=active]:bg-white/20 text-white">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Sessions ({employeeSessions.length})
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

                <TabsContent value="sessions" className="mt-4">
                  <ScrollArea className="h-[300px]">
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
                        <p className="text-blue-300/50 text-sm text-center py-4">No sessions</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="prompts" className="mt-4">
                  <ScrollArea className="h-[300px]">
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

                <TabsContent value="activity" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-lg">
                      <p className="text-blue-300 text-xs">Total Sessions</p>
                      <p className="text-2xl font-bold text-white">{employeeSessions.length}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg">
                      <p className="text-blue-300 text-xs">Saved Prompts</p>
                      <p className="text-2xl font-bold text-white">{employeePrompts.length}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg">
                      <p className="text-blue-300 text-xs">Account Created</p>
                      <p className="text-sm text-white">{formatDate(selectedUser.createdAt)}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg">
                      <p className="text-blue-300 text-xs">Last Active</p>
                      <p className="text-sm text-white">{formatDateTime(selectedUser.lastLoginAt)}</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={showEditRoleDialog} onOpenChange={setShowEditRoleDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update role for {selectedUser?.name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(val) => setFormData({ ...formData, role: val })}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableRoles().map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div>
                        <p>{role.label}</p>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditRoleDialog(false)} className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={showEditOrgDialog} onOpenChange={setShowEditOrgDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Change Company</DialogTitle>
            <DialogDescription>
              Update company for {selectedUser?.name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="space-y-2">
              <Label>Company</Label>
              <Select
                value={formData.organizationId || '__none__'}
                onValueChange={(val) => setFormData({ ...formData, organizationId: val === '__none__' ? '' : val })}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select company (or leave empty)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Company</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditOrgDialog(false)} className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
              Cancel
            </Button>
            <Button onClick={handleUpdateOrganization} disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={showEditDeptDialog} onOpenChange={setShowEditDeptDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Change Department</DialogTitle>
            <DialogDescription>
              Update department for {selectedUser?.name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={formData.departmentId || '__none__'}
                onValueChange={(val) => setFormData({ ...formData, departmentId: val === '__none__' ? '' : val })}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select department (or leave empty)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Department</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditDeptDialog(false)} className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
              Cancel
            </Button>
            <Button onClick={handleUpdateDepartment} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite/Add Employee Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isSuperAdmin() ? 'Invite User' : isDeptAdmin ? 'Add Team Member' : 'Add Employee'}
            </DialogTitle>
            <DialogDescription>
              {isSuperAdmin()
                ? 'Create a new user account.'
                : isDeptAdmin
                  ? `Add a new team member to ${department?.name || 'your department'}.`
                  : 'Add a new employee to your company.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                  {error}
                </div>
              )}

              {/* Employee Information */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-blue-300 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Employee Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-white">First Name *</Label>
                    <Input
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="John"
                      className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Last Name *</Label>
                    <Input
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Smith"
                      className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-400" />
                    Email *
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="employee@company.com"
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-400" />
                    Password *
                  </Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimum 8 characters"
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-400" />
                    Job Title
                  </Label>
                  <Input
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    placeholder="e.g. Software Engineer, Marketing Manager"
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                  />
                </div>
              </div>

              {/* Assignment section - only show for Company Admin and Super Admin */}
              {!isDeptAdmin && (
                <>
                  {/* Divider */}
                  <div className="border-t border-white/10 pt-4">
                    <h4 className="text-sm font-medium text-blue-300 flex items-center gap-2">
                      <FolderTree className="w-4 h-4" />
                      Assignment
                    </h4>
                  </div>

                  {/* Assignment */}
                  <div className="space-y-3">
                    {isSuperAdmin() && (
                      <div className="space-y-2">
                        <Label className="text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-purple-400" />
                          Company
                        </Label>
                        <Select
                          value={formData.organizationId}
                          onValueChange={(val) => {
                            setFormData({ ...formData, organizationId: val, departmentId: '' });
                            if (val) loadDepartments(val);
                          }}
                        >
                          <SelectTrigger className="bg-white/10 border-white/20 text-white">
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                          <SelectContent>
                            {organizations.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-white flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-green-400" />
                        Department
                        <span className="text-blue-300/70 text-xs font-normal">(optional)</span>
                      </Label>
                      <Popover open={showDeptSuggestions} onOpenChange={setShowDeptSuggestions}>
                        <PopoverTrigger asChild>
                          <div className="relative">
                            <Input
                              value={departmentSearchText}
                              onChange={(e) => {
                                const value = e.target.value;
                                setDepartmentSearchText(value);
                                setShowDeptSuggestions(true);
                                // Clear departmentId if user is typing a new value
                                if (formData.departmentId) {
                                  const selectedDept = departments.find(d => d.id === formData.departmentId);
                                  if (selectedDept && selectedDept.name !== value) {
                                    setFormData({ ...formData, departmentId: '' });
                                  }
                                }
                              }}
                              onFocus={() => setShowDeptSuggestions(true)}
                              placeholder="Start typing to search departments..."
                              className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                            />
                            {formData.departmentId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, departmentId: '' });
                                  setDepartmentSearchText('');
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0 bg-slate-800 border-white/20"
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                          <div className="max-h-48 overflow-y-auto">
                            {departments.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-blue-300/70">
                                No departments available
                              </div>
                            ) : (
                              departments
                                .filter(dept =>
                                  !departmentSearchText ||
                                  dept.name.toLowerCase().includes(departmentSearchText.toLowerCase())
                                )
                                .map((dept) => (
                                  <button
                                    key={dept.id}
                                    type="button"
                                    onClick={() => {
                                      setFormData({ ...formData, departmentId: dept.id });
                                      setDepartmentSearchText(dept.name);
                                      setShowDeptSuggestions(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors ${
                                      formData.departmentId === dept.id ? 'bg-green-500/20 text-green-300' : 'text-white'
                                    }`}
                                  >
                                    {dept.name}
                                  </button>
                                ))
                            )}
                            {departments.length > 0 &&
                              departmentSearchText &&
                              !departments.some(d => d.name.toLowerCase().includes(departmentSearchText.toLowerCase())) && (
                              <div className="px-3 py-2 text-sm text-blue-300/70">
                                No matching departments
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-400" />
                        Role
                      </Label>
                      <Select
                        value={formData.role}
                        onValueChange={(val) => setFormData({ ...formData, role: val })}
                      >
                        <SelectTrigger className="bg-white/10 border-white/20 text-white">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableRoles().map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {/* For Department Admins - show auto-filled department (read-only) */}
              {isDeptAdmin && (
                <div className="border-t border-white/10 pt-4">
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-green-300">
                      <FolderTree className="w-4 h-4" />
                      <span className="text-sm font-medium">Department</span>
                    </div>
                    <p className="text-white mt-1">{department?.name || 'Your Department'}</p>
                    <p className="text-green-300/70 text-xs mt-1">
                      New team members will be added to your department automatically
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setShowInviteDialog(false)} className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
              Cancel
            </Button>
            <Button onClick={handleInviteUser} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {isSuperAdmin() ? 'Create User' : isDeptAdmin ? 'Add Team Member' : 'Add Employee'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-yellow-400" />
              Edit User
            </DialogTitle>
            <DialogDescription>
              Update details for {selectedUser?.name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-white">Name *</Label>
              <Input
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="Full name"
                className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Email *
              </Label>
              <Input
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="email@example.com"
                className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-400" />
                Job Title
              </Label>
              <Input
                value={editFormData.jobTitle}
                onChange={(e) => setEditFormData({ ...editFormData, jobTitle: e.target.value })}
                placeholder="e.g. Software Engineer"
                className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setShowEditUserDialog(false)} className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={isSubmitting} className="bg-yellow-600 hover:bg-yellow-700">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GDPR Data Erasure Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Erase User Data (GDPR)
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-blue-300 space-y-3">
                <p>
                  Are you sure you want to erase all data for <span className="text-white font-medium">{selectedUser?.name || selectedUser?.email}</span>?
                </p>
                <div className="text-sm space-y-1">
                  <p>This GDPR-compliant erasure will permanently:</p>
                  <ul className="list-disc ml-4 text-blue-300/80">
                    <li>Delete their account and profile</li>
                    <li>Delete all role sessions and deliverables</li>
                    <li>Delete all uploaded files from storage</li>
                    <li>Delete all time study records</li>
                    <li>Anonymize their activity logs (retained for compliance)</li>
                  </ul>
                </div>
                <p className="text-red-300/80 text-sm">This action cannot be undone.</p>
              </div>
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
              onClick={handleDeleteUser}
              disabled={isSubmitting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Erase All Data'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pause/Activate User Confirmation */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              {selectedUser?.isActive !== false ? (
                <>
                  <Pause className="w-5 h-5 text-orange-400" />
                  Pause Account
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 text-green-400" />
                  Activate Account
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300">
              {selectedUser?.isActive !== false ? (
                <>
                  Are you sure you want to pause <span className="text-white font-medium">{selectedUser?.name || selectedUser?.email}</span>'s account?
                  They will be logged out and unable to access the system until reactivated.
                </>
              ) : (
                <>
                  Are you sure you want to reactivate <span className="text-white font-medium">{selectedUser?.name || selectedUser?.email}</span>'s account?
                  They will be able to log in and access the system again.
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
              className={selectedUser?.isActive !== false
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-green-600 text-white hover:bg-green-700'
              }
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : selectedUser?.isActive !== false ? (
                'Pause Account'
              ) : (
                'Activate Account'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
