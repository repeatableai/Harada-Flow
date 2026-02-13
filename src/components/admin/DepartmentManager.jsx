import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  FolderTree,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Users,
  Building2,
  Loader2,
  User,
  Mail,
  Lock,
  Briefcase,
  UserCog,
  Eye,
  Shield,
  Pause,
  Play,
  AlertTriangle,
  FileText,
  Clock,
  Activity,
} from 'lucide-react';

const ROLE_OPTIONS = [
  { value: 'USER', label: 'User', description: 'Regular user access' },
  { value: 'DEPARTMENT_ADMIN', label: 'Department Admin', description: 'Manage department users' },
];

const ROLE_COLORS = {
  USER: 'border-gray-400 text-gray-300',
  DEPARTMENT_ADMIN: 'border-green-400 text-green-300',
  COMPANY_ADMIN: 'border-blue-400 text-blue-300',
  ADMIN: 'border-blue-400 text-blue-300',
  SUPER_ADMIN: 'border-purple-400 text-purple-300',
};

export default function DepartmentManager() {
  const { user, isCompanyAdmin, isSuperAdmin, organization, canManage } = useAuth();
  const [departments, setDepartments] = useState({ data: [], pagination: {} });
  const [organizations, setOrganizations] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]); // For department change dropdown
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    organizationId: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminJobTitle: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Department Details state
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [departmentUsers, setDepartmentUsers] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeSessions, setEmployeeSessions] = useState([]);
  const [employeePrompts, setEmployeePrompts] = useState([]);
  const [loadingEmployeeData, setLoadingEmployeeData] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // User management dialogs
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showDeleteUserDialog, setShowDeleteUserDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showChangeRoleDialog, setShowChangeRoleDialog] = useState(false);
  const [showChangeDeptDialog, setShowChangeDeptDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    jobTitle: '',
    role: '',
    departmentId: '',
  });

  useEffect(() => {
    if (isSuperAdmin()) {
      loadOrganizations();
    } else if (organization) {
      setSelectedOrg(organization.id);
      loadDepartments(1, organization.id);
      loadAllDepartments(organization.id);
    }
  }, [organization]);

  const loadOrganizations = async () => {
    try {
      const data = await apiClient.organizations.list({ limit: 100 });
      setOrganizations(data.data || []);
      if (data.data?.length > 0) {
        setSelectedOrg(data.data[0].id);
        loadDepartments(1, data.data[0].id);
        loadAllDepartments(data.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    }
  };

  const loadAllDepartments = async (orgId) => {
    if (!orgId) return;
    try {
      const data = await apiClient.departments.list(orgId, { limit: 100 });
      setAllDepartments(data.data || []);
    } catch (error) {
      console.error('Failed to load all departments:', error);
    }
  };

  const loadDepartments = async (pageNum, orgId = selectedOrg, search = searchQuery) => {
    if (!orgId) return;

    setIsLoading(true);
    try {
      const data = await apiClient.departments.list(orgId, {
        page: pageNum,
        limit: 10,
        search: search || undefined,
      });
      setDepartments(data);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load departments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepartmentUsers = async (deptId) => {
    setLoadingUsers(true);
    try {
      const data = await apiClient.departments.getUsers(deptId, { limit: 100 });
      setDepartmentUsers(data.data || []);
    } catch (error) {
      console.error('Failed to load department users:', error);
      setDepartmentUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadEmployeeDetails = async (employee) => {
    setSelectedEmployee(employee);
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

  const handleOrgChange = (orgId) => {
    setSelectedOrg(orgId);
    setSearchQuery('');
    loadDepartments(1, orgId, '');
    loadAllDepartments(orgId);
  };

  const handleSearch = () => {
    loadDepartments(1, selectedOrg, searchQuery);
  };

  const handleCreate = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      setError('Department name is required');
      return;
    }

    const orgId = isSuperAdmin() ? formData.organizationId : organization?.id;
    if (!orgId) {
      setError('Company is required');
      return;
    }

    // Validate admin fields
    if (!formData.adminName.trim()) {
      setError('Department Admin name is required');
      return;
    }
    if (!formData.adminEmail.trim()) {
      setError('Department Admin email is required');
      return;
    }
    if (!formData.adminPassword.trim()) {
      setError('Department Admin password is required');
      return;
    }
    if (formData.adminPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.departments.create(orgId, {
        name: formData.name,
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
        organizationId: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        adminJobTitle: '',
      });
      loadDepartments(1, orgId);
      loadAllDepartments(orgId);
    } catch (error) {
      setError(error.message || 'Failed to create department');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!formData.name.trim()) {
      setError('Department name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.departments.update(selectedDept.id, { name: formData.name });
      setShowEditDialog(false);
      setSelectedDept(null);
      setFormData({ name: '', organizationId: '' });
      loadDepartments(page);
    } catch (error) {
      setError(error.message || 'Failed to update department');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.departments.delete(selectedDept.id);
      setShowDeleteDialog(false);
      setSelectedDept(null);
      loadDepartments(1);
    } catch (error) {
      setError(error.message || 'Failed to delete department');
    } finally {
      setIsSubmitting(false);
    }
  };

  // User management handlers
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
      await apiClient.admin.updateUser(selectedEmployee.id, {
        name: editFormData.name.trim(),
        email: editFormData.email.trim().toLowerCase(),
        jobTitle: editFormData.jobTitle?.trim() || null,
      });
      setShowEditUserDialog(false);
      // Reload department users
      await loadDepartmentUsers(selectedDept.id);
      // Update selected employee if still viewing
      const updated = departmentUsers.find(u => u.id === selectedEmployee.id);
      if (updated) setSelectedEmployee(updated);
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
      await apiClient.admin.deleteUser(selectedEmployee.id);
      setShowDeleteUserDialog(false);
      setSelectedEmployee(null);
      await loadDepartmentUsers(selectedDept.id);
      loadDepartments(page); // Refresh counts
    } catch (error) {
      setError(error.message || 'Failed to delete user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.admin.toggleUserStatus(selectedEmployee.id, !selectedEmployee.isActive);
      setShowStatusDialog(false);
      await loadDepartmentUsers(selectedDept.id);
      // Update selected employee
      const updated = departmentUsers.find(u => u.id === selectedEmployee.id);
      if (updated) setSelectedEmployee({ ...selectedEmployee, isActive: !selectedEmployee.isActive });
    } catch (error) {
      setError(error.message || 'Failed to update user status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeRole = async () => {
    if (!editFormData.role) {
      setError('Role is required');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.admin.updateUserRole(selectedEmployee.id, editFormData.role);
      setShowChangeRoleDialog(false);
      await loadDepartmentUsers(selectedDept.id);
      setSelectedEmployee({ ...selectedEmployee, role: editFormData.role });
    } catch (error) {
      setError(error.message || 'Failed to update role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeDepartment = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.admin.updateUserDepartment(selectedEmployee.id, editFormData.departmentId || null);
      setShowChangeDeptDialog(false);
      await loadDepartmentUsers(selectedDept.id);
      // If user moved to different dept, clear selection
      if (editFormData.departmentId !== selectedDept.id) {
        setSelectedEmployee(null);
      }
      loadDepartments(page); // Refresh counts
    } catch (error) {
      setError(error.message || 'Failed to update department');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateDialog = () => {
    setFormData({
      name: '',
      organizationId: selectedOrg || '',
      adminName: '',
      adminEmail: '',
      adminPassword: '',
      adminJobTitle: '',
    });
    setError('');
    setShowCreateDialog(true);
  };

  const openEditDialog = (dept) => {
    setSelectedDept(dept);
    setFormData({ name: dept.name, organizationId: dept.organizationId });
    setError('');
    setShowEditDialog(true);
  };

  const openDeleteDialog = (dept) => {
    setSelectedDept(dept);
    setError('');
    setShowDeleteDialog(true);
  };

  const openDetailsDialog = async (dept) => {
    setSelectedDept(dept);
    setSelectedEmployee(null);
    setEmployeeSessions([]);
    setEmployeePrompts([]);
    await loadDepartmentUsers(dept.id);
    setShowDetailsDialog(true);
  };

  // User action openers
  const openEditUserDialog = (emp) => {
    setSelectedEmployee(emp);
    setEditFormData({
      name: emp.name || '',
      email: emp.email || '',
      jobTitle: emp.job_title || '',
    });
    setError('');
    setShowEditUserDialog(true);
  };

  const openDeleteUserDialog = (emp) => {
    setSelectedEmployee(emp);
    setError('');
    setShowDeleteUserDialog(true);
  };

  const openStatusDialog = (emp) => {
    setSelectedEmployee(emp);
    setError('');
    setShowStatusDialog(true);
  };

  const openChangeRoleDialog = (emp) => {
    setSelectedEmployee(emp);
    setEditFormData({ ...editFormData, role: emp.role });
    setError('');
    setShowChangeRoleDialog(true);
  };

  const openChangeDeptDialog = (emp) => {
    setSelectedEmployee(emp);
    setEditFormData({ ...editFormData, departmentId: emp.departmentId || '' });
    setError('');
    setShowChangeDeptDialog(true);
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

  if (!isCompanyAdmin()) {
    return (
      <Card className="bg-white/10 border-white/20">
        <CardContent className="p-8 text-center">
          <p className="text-blue-300">Only Company Admins and above can manage departments.</p>
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
            <FolderTree className="w-5 h-5 text-green-400" />
            Departments
          </h3>
          <p className="text-blue-300 text-sm">
            Manage departments{organization ? ` in ${organization.name}` : ' across your company'}
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-green-600 hover:bg-green-700"
          disabled={!selectedOrg}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Department
        </Button>
      </div>

      {/* Company Selector (Super Admin only) */}
      {isSuperAdmin() && organizations.length > 0 && (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-300" />
          <Select value={selectedOrg} onValueChange={handleOrgChange}>
            <SelectTrigger className="w-[250px] bg-white/10 border-white/20 text-white">
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

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Search departments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="bg-white/10 border-white/20 text-white placeholder-blue-300"
        />
        <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Departments Table */}
      <Card className="bg-white/10 border-white/20">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : !selectedOrg ? (
            <div className="p-8 text-center text-blue-300">
              Select a company to view departments.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-blue-200 font-medium">Department</th>
                    {isSuperAdmin() && (
                      <th className="text-left p-4 text-blue-200 font-medium">Company</th>
                    )}
                    <th className="text-center p-4 text-blue-200 font-medium">Users</th>
                    <th className="text-left p-4 text-blue-200 font-medium">Created</th>
                    <th className="text-right p-4 text-blue-200 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.data?.map((dept) => (
                    <tr key={dept.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <p className="text-white font-medium">{dept.name}</p>
                      </td>
                      {isSuperAdmin() && (
                        <td className="p-4">
                          <Badge variant="outline" className="border-purple-400/50 text-purple-300">
                            {dept.organization?.name}
                          </Badge>
                        </td>
                      )}
                      <td className="p-4 text-center">
                        <span className="flex items-center justify-center gap-1 text-blue-300">
                          <Users className="w-4 h-4" />
                          {dept.usersCount}
                        </span>
                      </td>
                      <td className="p-4 text-blue-300 text-sm">
                        {formatDate(dept.createdAt)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDetailsDialog(dept)}
                            className="text-green-300 hover:text-white hover:bg-white/10"
                            title="View Users"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(dept)}
                            className="text-blue-300 hover:text-white hover:bg-white/10"
                            title="Edit Department"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDeleteDialog(dept)}
                            className="text-red-300 hover:text-red-200 hover:bg-red-500/10"
                            disabled={dept.usersCount > 0}
                            title="Delete Department"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!departments.data || departments.data.length === 0) && (
                    <tr>
                      <td colSpan={isSuperAdmin() ? 5 : 4} className="p-8 text-center text-blue-300">
                        No departments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {departments.pagination?.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-white/10">
              <p className="text-blue-300 text-sm">
                Page {departments.pagination.page} of {departments.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadDepartments(page - 1)}
                  disabled={page <= 1}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadDepartments(page + 1)}
                  disabled={page >= departments.pagination.totalPages}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-green-400" />
              {selectedDept?.name}
            </DialogTitle>
            <DialogDescription>
              View and manage users in this department
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4 h-[60vh]">
            {/* User List */}
            <div className="w-1/3 border-r border-white/10 pr-4">
              <h4 className="text-sm font-medium text-blue-200 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Users ({departmentUsers.length})
              </h4>
              {loadingUsers ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                </div>
              ) : (
                <ScrollArea className="h-[calc(100%-2rem)]">
                  <div className="space-y-2">
                    {departmentUsers.map((emp) => (
                      <div
                        key={emp.id}
                        onClick={() => loadEmployeeDetails(emp)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedEmployee?.id === emp.id
                            ? 'bg-green-500/20 border border-green-500/50'
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <p className="text-white font-medium text-sm">{emp.name || 'Unknown'}</p>
                        <p className="text-blue-300 text-xs">{emp.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-xs ${ROLE_COLORS[emp.role] || ROLE_COLORS.USER}`}>
                            {emp.role}
                          </Badge>
                          {emp.isActive === false && (
                            <Badge variant="outline" className="text-xs border-red-400 text-red-300">
                              Paused
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {departmentUsers.length === 0 && (
                      <p className="text-blue-300/50 text-sm text-center py-4">No users in this department</p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Employee Details */}
            <div className="flex-1 pl-4">
              {selectedEmployee ? (
                loadingEmployeeData ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    {/* Employee Header with Actions */}
                    <div className="mb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-white font-medium">{selectedEmployee.name || selectedEmployee.email}</h4>
                          <p className="text-blue-300 text-sm">{selectedEmployee.email}</p>
                          <p className="text-blue-300/70 text-xs mt-1">
                            Last login: {formatDateTime(selectedEmployee.lastLoginAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditUserDialog(selectedEmployee)}
                            className="text-yellow-300 hover:text-white hover:bg-white/10"
                            title="Edit User"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openChangeRoleDialog(selectedEmployee)}
                            className="text-blue-300 hover:text-white hover:bg-white/10"
                            title="Change Role"
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openChangeDeptDialog(selectedEmployee)}
                            className="text-purple-300 hover:text-white hover:bg-white/10"
                            title="Change Department"
                          >
                            <FolderTree className="w-4 h-4" />
                          </Button>
                          {selectedEmployee.id !== user.id && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openStatusDialog(selectedEmployee)}
                                className={selectedEmployee.isActive !== false
                                  ? 'text-orange-300 hover:text-white hover:bg-orange-500/10'
                                  : 'text-green-300 hover:text-white hover:bg-green-500/10'
                                }
                                title={selectedEmployee.isActive !== false ? 'Pause Account' : 'Activate Account'}
                              >
                                {selectedEmployee.isActive !== false ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openDeleteUserDialog(selectedEmployee)}
                                className="text-red-300 hover:text-white hover:bg-red-500/10"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Tabs defaultValue="sessions" className="flex-1 flex flex-col">
                      <TabsList className="bg-white/10 border border-white/20 mb-4">
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
                              <p className="text-blue-300/50 text-sm text-center py-4">No sessions</p>
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
                              <p className="text-sm text-white">{formatDate(selectedEmployee.createdAt)}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                              <p className="text-blue-300 text-xs">Last Active</p>
                              <p className="text-sm text-white">{formatDateTime(selectedEmployee.lastLoginAt)}</p>
                            </div>
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-full text-blue-300/50 text-center">
                  <div>
                    <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Select a user to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Department</DialogTitle>
            <DialogDescription>Add a new department and designate its administrator.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                  {error}
                </div>
              )}

              {/* Department Information */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-green-300 flex items-center gap-2">
                  <FolderTree className="w-4 h-4" />
                  Department Information
                </h4>
                {isSuperAdmin() && (
                  <div className="space-y-2">
                    <Label className="text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-400" />
                      Company *
                    </Label>
                    <Select
                      value={formData.organizationId}
                      onValueChange={(val) => setFormData({ ...formData, organizationId: val })}
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
                  <Label className="text-white">Department Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Engineering, Sales, Marketing"
                    className="bg-white/10 border-white/20 text-white placeholder-blue-300/50"
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-sm font-medium text-green-300 flex items-center gap-2">
                  <UserCog className="w-4 h-4" />
                  Department Administrator
                </h4>
              </div>

              {/* Admin Information */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-green-400" />
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
                    <Mail className="w-4 h-4 text-green-400" />
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
                    <Lock className="w-4 h-4 text-green-400" />
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
                    <Briefcase className="w-4 h-4 text-green-400" />
                    Admin Job Title
                  </Label>
                  <Input
                    value={formData.adminJobTitle}
                    onChange={(e) => setFormData({ ...formData, adminJobTitle: e.target.value })}
                    placeholder="e.g., Department Manager"
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
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Department'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>Update department details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
            <div className="space-y-2">
              <Label>Department Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter department name"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
          </div>
          <DialogFooter>
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

      {/* Delete Department Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Delete Department</DialogTitle>
            <DialogDescription>Are you sure you want to delete this department?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
            {selectedDept && (
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-white font-medium">{selectedDept.name}</p>
                <p className="text-blue-300 text-sm">
                  {selectedDept.usersCount} users
                </p>
              </div>
            )}
            {selectedDept?.usersCount > 0 && (
              <p className="text-yellow-400 text-sm">
                Cannot delete department with users. Reassign users first.
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
              disabled={isSubmitting || selectedDept?.usersCount > 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
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
              Update details for {selectedEmployee?.name || selectedEmployee?.email}
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
            <Button
              variant="ghost"
              onClick={() => setShowEditUserDialog(false)}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={isSubmitting}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={showChangeRoleDialog} onOpenChange={setShowChangeRoleDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Change Role
            </DialogTitle>
            <DialogDescription>
              Update role for {selectedEmployee?.name || selectedEmployee?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editFormData.role}
                onValueChange={(val) => setEditFormData({ ...editFormData, role: val })}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
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
            <Button
              variant="ghost"
              onClick={() => setShowChangeRoleDialog(false)}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Department Dialog */}
      <Dialog open={showChangeDeptDialog} onOpenChange={setShowChangeDeptDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-purple-400" />
              Change Department
            </DialogTitle>
            <DialogDescription>
              Move {selectedEmployee?.name || selectedEmployee?.email} to a different department
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={editFormData.departmentId || '__none__'}
                onValueChange={(val) => setEditFormData({ ...editFormData, departmentId: val === '__none__' ? '' : val })}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Department</SelectItem>
                  {allDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowChangeDeptDialog(false)}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangeDepartment}
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={showDeleteUserDialog} onOpenChange={setShowDeleteUserDialog}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300">
              Are you sure you want to delete <span className="text-white font-medium">{selectedEmployee?.name || selectedEmployee?.email}</span>?
              This will permanently remove their account and all associated data. This action cannot be undone.
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
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pause/Activate User Confirmation */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              {selectedEmployee?.isActive !== false ? (
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
              {selectedEmployee?.isActive !== false ? (
                <>
                  Are you sure you want to pause <span className="text-white font-medium">{selectedEmployee?.name || selectedEmployee?.email}</span>'s account?
                  They will be logged out and unable to access the system until reactivated.
                </>
              ) : (
                <>
                  Are you sure you want to reactivate <span className="text-white font-medium">{selectedEmployee?.name || selectedEmployee?.email}</span>'s account?
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
              className={selectedEmployee?.isActive !== false
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-green-600 text-white hover:bg-green-700'
              }
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : selectedEmployee?.isActive !== false ? (
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
