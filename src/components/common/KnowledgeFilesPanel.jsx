import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Upload,
  Download,
  Trash2,
  File,
  FileText,
  FileSpreadsheet,
  Image,
  Loader2,
  FolderOpen,
  X,
  AlertCircle,
  Eye,
  ArrowLeft,
  Users,
  Building2,
  User as UserIcon,
} from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/gif',
];

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mimeType, size = 4) => {
  const className = `w-${size} h-${size}`;
  if (mimeType?.includes('pdf')) return <FileText className={`${className} text-red-400`} />;
  if (mimeType?.includes('word') || mimeType?.includes('document')) return <FileText className={`${className} text-blue-400`} />;
  if (mimeType?.includes('sheet') || mimeType?.includes('excel') || mimeType?.includes('csv')) return <FileSpreadsheet className={`${className} text-green-400`} />;
  if (mimeType?.includes('image')) return <Image className={`${className} text-purple-400`} />;
  return <File className={`${className} text-gray-400`} />;
};

const getScopeBadge = (scope) => {
  const colors = {
    self: 'bg-gray-500/20 text-gray-300 border-gray-500/50',
    departments: 'bg-green-500/20 text-green-300 border-green-500/50',
    users: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
    company: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
    system: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  };
  const labels = {
    self: 'Personal',
    departments: 'Department',
    users: 'Shared',
    company: 'Company',
    system: 'System',
  };
  return (
    <Badge className={`text-xs ${colors[scope] || colors.self}`}>
      {labels[scope] || scope}
    </Badge>
  );
};

// Check if file can be previewed in browser
const canPreview = (mimeType) => {
  return (
    mimeType?.includes('image') ||
    mimeType === 'application/pdf' ||
    mimeType === 'text/plain' ||
    mimeType === 'text/csv'
  );
};

export default function KnowledgeFilesPanel({ open, onOpenChange, currentCompanyId = null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);
  const fileInputRef = useRef(null);

  // Scope selection state
  const [selectedScope, setSelectedScope] = useState('self');
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);

  // User selection state for "users" scope
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Organization selection state for super admin "organizations" scope
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);

  // Determine user's admin level
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.userType === 'superadmin';
  const isCompanyAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'ADMIN' || isSuperAdmin;
  const isDepartmentAdmin = user?.role === 'DEPARTMENT_ADMIN';
  const canSetScope = isCompanyAdmin || isDepartmentAdmin;

  useEffect(() => {
    if (open) {
      loadFiles();
      if (canSetScope) {
        loadDepartments();
      }
      if (isSuperAdmin) {
        loadOrganizations();
      }
    }
  }, [open]);

  // Reset scope when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedScope('self');
      setSelectedDepartments([]);
      setSelectedUsers([]);
      setUserSearchTerm('');
      setUserSearchResults([]);
      setSelectedOrganization(null);
    }
  }, [open]);

  const loadDepartments = async () => {
    if (!user?.organizationId) return;
    setIsLoadingDepartments(true);
    try {
      const result = await apiClient.departments.list(user.organizationId);
      // Handle both array and {data: [...]} response formats
      const deptList = Array.isArray(result) ? result : (result?.data || result?.departments || []);
      setDepartments(Array.isArray(deptList) ? deptList : []);
    } catch (error) {
      console.error('Failed to load departments:', error);
      setDepartments([]);
    } finally {
      setIsLoadingDepartments(false);
    }
  };

  const loadOrganizations = async () => {
    setIsLoadingOrganizations(true);
    try {
      const result = await apiClient.organizations.list();
      const orgList = Array.isArray(result) ? result : (result?.data || result?.organizations || []);
      setOrganizations(Array.isArray(orgList) ? orgList : []);
    } catch (error) {
      console.error('Failed to load organizations:', error);
      setOrganizations([]);
    } finally {
      setIsLoadingOrganizations(false);
    }
  };

  // Search users for autocomplete
  const searchUsers = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2 || !user?.organizationId) {
      setUserSearchResults([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const result = await apiClient.organizations.getUsers(user.organizationId, { search: searchTerm, limit: 10 });
      const userList = Array.isArray(result) ? result : (result?.data || result?.users || []);
      // Filter out already selected users and the current user
      const filtered = userList.filter(u =>
        u.id !== user.id && !selectedUsers.some(su => su.id === u.id)
      );
      setUserSearchResults(filtered);
    } catch (error) {
      console.error('Failed to search users:', error);
      setUserSearchResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedScope === 'users' && userSearchTerm) {
        searchUsers(userSearchTerm);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchTerm, selectedScope]);

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const result = await apiClient.knowledgeFiles.list({ limit: 100 });
      setFiles(result.data || []);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    setUploadError('');
    setIsUploading(true);

    // Determine departments, users, and organization to share with
    let deptIds = [];
    let userIds = [];
    let orgId = null;
    let actualScope = selectedScope;

    if (selectedScope === 'myDepartment') {
      deptIds = user?.departmentId ? [user.departmentId] : [];
      actualScope = 'departments'; // API expects 'departments' scope
    } else if (selectedScope === 'departments') {
      deptIds = selectedDepartments;
    } else if (selectedScope === 'users') {
      userIds = selectedUsers.map(u => u.id);
    } else if (selectedScope === 'organizations') {
      // Super admin uploading for a specific company
      orgId = selectedOrganization?.id || null;
      actualScope = 'company'; // Use company scope for the target organization
    }

    for (const file of selectedFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError(`${file.name}: File type not allowed`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`${file.name}: File too large (max 10MB)`);
        continue;
      }

      try {
        const result = await apiClient.knowledgeFiles.upload(
          file,
          actualScope,
          deptIds,
          '',
          orgId,
          userIds
        );

        // CUI sniffer: WARN
        if (result.cuiWarning) {
          setUploadError('Your file was not uploaded. There is a possibility that it violates CUI compliance regulations. Please contact your IT executive or manager to determine acceptance criteria.');
          toast({
            title: "Upload Rejected",
            description: "Your file was not uploaded. There is a possibility that it violates CUI compliance regulations. Please contact your IT executive or manager to determine acceptance criteria.",
            variant: "destructive",
            duration: 10000,
          });
          continue;
        }

        // CUI sniffer: PASS — no notification
      } catch (error) {
        if (error.cuiBlocked) {
          setUploadError('Your file was not uploaded. There is a possibility that it violates CUI compliance regulations. Please contact your IT executive or manager to determine acceptance criteria.');
          toast({
            title: "Upload Rejected",
            description: "Your file was not uploaded. There is a possibility that it violates CUI compliance regulations. Please contact your IT executive or manager to determine acceptance criteria.",
            variant: "destructive",
            duration: 10000,
          });
        } else {
          console.error('Failed to upload file:', file.name, error);
          setUploadError(`Failed to upload ${file.name}`);
        }
      }
    }

    setIsUploading(false);
    // Reset scope after upload
    setSelectedScope('self');
    setSelectedDepartments([]);
    setSelectedUsers([]);
    setUserSearchTerm('');
    setSelectedOrganization(null);
    loadFiles();
    e.target.value = '';
  };

  const handleView = (file) => {
    setViewingFile(file);
  };

  const handleDownload = async (file) => {
    try {
      const { blob, filename } = await apiClient.knowledgeFiles.download(file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  const handleDelete = async (fileId) => {
    setDeletingId(fileId);
    try {
      await apiClient.knowledgeFiles.delete(fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (error) {
      console.error('Failed to delete file:', error);
    } finally {
      setDeletingId(null);
    }
  };

  // Separate files by session vs other personal files
  const sessionFiles = currentCompanyId
    ? files.filter(f => f.companyId === currentCompanyId)
    : [];
  const otherFiles = currentCompanyId
    ? files.filter(f => f.companyId !== currentCompanyId)
    : files;

  // Further categorize: my uploads vs shared with me
  const myFiles = otherFiles.filter(f => f.uploaderId === user?.id);
  const sharedFiles = otherFiles.filter(f => f.uploaderId !== user?.id);

  // If viewing a file, show the viewer
  if (viewingFile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-slate-900 border-white/20 text-white max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingFile(null)}
                className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <DialogTitle className="flex items-center gap-2 truncate">
                  {getFileIcon(viewingFile.mimeType)}
                  <span className="truncate">{viewingFile.originalName}</span>
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1 text-sm text-blue-300">
                  <span>{formatFileSize(viewingFile.size)}</span>
                  {getScopeBadge(viewingFile.scope)}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(viewingFile)}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden rounded-lg bg-white/5 border border-white/10">
            <FileViewer file={viewingFile} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-white/20 text-white max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-400" />
            Knowledge Files
          </DialogTitle>
          <DialogDescription>
            Upload and manage your reference files. These files help generate better deliverables.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Upload Section */}
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Scope Selector - Only for admins */}
            {canSetScope && (
              <div className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm text-blue-200">Who can see uploaded files?</Label>
                  <Select value={selectedScope} onValueChange={(value) => {
                    setSelectedScope(value);
                    // Auto-select user's department when "myDepartment" is chosen
                    if (value === 'myDepartment' && user?.departmentId) {
                      setSelectedDepartments([user.departmentId]);
                    } else if (value !== 'departments') {
                      setSelectedDepartments([]);
                    }
                  }}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-white/20">
                      <SelectItem value="self" className="text-white hover:bg-white/10">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                          <span>Only me (Personal)</span>
                        </div>
                      </SelectItem>
                      {user?.departmentId && (
                        <SelectItem value="myDepartment" className="text-white hover:bg-white/10">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-green-400" />
                            <span>My Department</span>
                          </div>
                        </SelectItem>
                      )}
                      <SelectItem value="departments" className="text-white hover:bg-white/10">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-amber-400" />
                          <span>Specific Departments</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="users" className="text-white hover:bg-white/10">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-purple-400" />
                          <span>Specific Users</span>
                        </div>
                      </SelectItem>
                      {isCompanyAdmin && (
                        <SelectItem value="company" className="text-white hover:bg-white/10">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-400" />
                            <span>My Company</span>
                          </div>
                        </SelectItem>
                      )}
                      {isSuperAdmin && (
                        <SelectItem value="organizations" className="text-white hover:bg-white/10">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-cyan-400" />
                            <span>Specific Company</span>
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department selector - for both department admins and company admins when "departments" scope is selected */}
                {selectedScope === 'departments' && (
                  <div className="space-y-2">
                    <Label className="text-sm text-blue-200">Select Departments</Label>
                    {isLoadingDepartments ? (
                      <div className="flex items-center gap-2 text-blue-300 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading departments...
                      </div>
                    ) : departments.length === 0 ? (
                      <p className="text-sm text-blue-400">No departments found</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {departments.map(dept => (
                          <button
                            key={dept.id}
                            type="button"
                            onClick={() => {
                              setSelectedDepartments(prev =>
                                prev.includes(dept.id)
                                  ? prev.filter(id => id !== dept.id)
                                  : [...prev, dept.id]
                              );
                            }}
                            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                              selectedDepartments.includes(dept.id)
                                ? 'bg-green-500/30 border-green-500/50 text-green-200'
                                : 'bg-white/5 border-white/20 text-blue-200 hover:bg-white/10'
                            }`}
                          >
                            {dept.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedDepartments.length === 0 && (
                      <p className="text-xs text-amber-400">Select at least one department</p>
                    )}
                  </div>
                )}

                {/* User selector - when "users" scope is selected */}
                {selectedScope === 'users' && (
                  <div className="space-y-2">
                    <Label className="text-sm text-blue-200">Search and Select Users</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Type a name or email to search..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder-blue-300"
                      />
                      {isSearchingUsers && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                        </div>
                      )}
                    </div>
                    {/* Search results dropdown */}
                    {userSearchResults.length > 0 && (
                      <div className="bg-slate-800 border border-white/20 rounded-lg max-h-40 overflow-y-auto">
                        {userSearchResults.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelectedUsers(prev => [...prev, u]);
                              setUserSearchTerm('');
                              setUserSearchResults([]);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-white/10 text-sm flex items-center gap-2"
                          >
                            <div className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-xs text-purple-200">
                              {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white truncate">{u.name || 'No name'}</p>
                              <p className="text-xs text-blue-300 truncate">{u.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {userSearchTerm.length >= 2 && userSearchResults.length === 0 && !isSearchingUsers && (
                      <p className="text-sm text-blue-400">No users found</p>
                    )}
                    {/* Selected users */}
                    {selectedUsers.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedUsers.map(u => (
                          <div
                            key={u.id}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-500/30 border border-purple-500/50 rounded-full text-sm text-purple-200"
                          >
                            <span className="truncate max-w-[120px]">{u.name || u.email}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedUsers(prev => prev.filter(su => su.id !== u.id))}
                              className="hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedUsers.length === 0 && (
                      <p className="text-xs text-amber-400">Select at least one user</p>
                    )}
                  </div>
                )}

                {/* Organization selector - for super admin when "organizations" scope is selected */}
                {selectedScope === 'organizations' && isSuperAdmin && (
                  <div className="space-y-2">
                    <Label className="text-sm text-blue-200">Select Company</Label>
                    {isLoadingOrganizations ? (
                      <div className="flex items-center gap-2 text-blue-300 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading companies...
                      </div>
                    ) : organizations.length === 0 ? (
                      <p className="text-sm text-blue-400">No companies found</p>
                    ) : (
                      <Select
                        value={selectedOrganization?.id || ''}
                        onValueChange={(value) => {
                          const org = organizations.find(o => o.id === value);
                          setSelectedOrganization(org || null);
                        }}
                      >
                        <SelectTrigger className="bg-white/10 border-white/20 text-white">
                          <SelectValue placeholder="Select a company..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-white/20">
                          {organizations.map(org => (
                            <SelectItem key={org.id} value={org.id} className="text-white hover:bg-white/10">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-cyan-400" />
                                <span>{org.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {!selectedOrganization && (
                      <p className="text-xs text-amber-400">Select a company to upload files for</p>
                    )}
                  </div>
                )}

                {/* Info text about current selection */}
                <div className="text-xs text-blue-400">
                  {selectedScope === 'self' && 'Files will only be visible to you.'}
                  {selectedScope === 'myDepartment' && 'Files will be visible to everyone in your department.'}
                  {selectedScope === 'departments' && selectedDepartments.length > 0 &&
                    `Files will be visible to ${selectedDepartments.length} department(s).`}
                  {selectedScope === 'departments' && selectedDepartments.length === 0 &&
                    'Select departments to share with.'}
                  {selectedScope === 'users' && selectedUsers.length > 0 &&
                    `Files will be visible to ${selectedUsers.length} user(s).`}
                  {selectedScope === 'users' && selectedUsers.length === 0 &&
                    'Search and select users to share with.'}
                  {selectedScope === 'company' && 'Files will be visible to everyone in your company.'}
                  {selectedScope === 'organizations' && selectedOrganization &&
                    `Files will be visible to everyone in ${selectedOrganization.name}.`}
                  {selectedScope === 'organizations' && !selectedOrganization &&
                    'Select a company to upload files for.'}
                </div>
              </div>
            )}

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || (selectedScope === 'departments' && selectedDepartments.length === 0) || (selectedScope === 'myDepartment' && !user?.departmentId) || (selectedScope === 'users' && selectedUsers.length === 0) || (selectedScope === 'organizations' && !selectedOrganization)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Files
                </>
              )}
            </Button>
            <p className="text-xs text-blue-300 text-center">
              PDF, DOC, DOCX, TXT, CSV, XLS, XLSX, PNG, JPG, GIF (max 10MB)
            </p>
            {uploadError && (
              <div className="p-2 bg-red-500/20 border border-red-500/50 rounded flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{uploadError}</p>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-blue-300">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No files yet</p>
              <p className="text-sm text-blue-400">Upload files to help generate better deliverables</p>
            </div>
          ) : (
            <>
              {/* Current Session Files */}
              {sessionFiles.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-blue-200 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    Current Session Files
                  </h3>
                  <div className="space-y-2">
                    {sessionFiles.map(file => (
                      <FileRow
                        key={file.id}
                        file={file}
                        onView={handleView}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                        isDeleting={deletingId === file.id}
                        canDelete={file.uploaderId === user?.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* My Uploaded Files */}
              {myFiles.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-blue-200">My Uploaded Files</h3>
                  <div className="space-y-2">
                    {myFiles.map(file => (
                      <FileRow
                        key={file.id}
                        file={file}
                        onView={handleView}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                        isDeleting={deletingId === file.id}
                        canDelete={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Shared With Me */}
              {sharedFiles.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-blue-200">Shared With Me</h3>
                  <div className="space-y-2">
                    {sharedFiles.map(file => (
                      <FileRow
                        key={file.id}
                        file={file}
                        onView={handleView}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                        isDeleting={deletingId === file.id}
                        canDelete={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileRow({ file, onView, onDownload, onDelete, isDeleting, canDelete }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
      {getFileIcon(file.mimeType)}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm truncate">{file.originalName}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-blue-300">{formatFileSize(file.size)}</span>
          {getScopeBadge(file.scope)}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(file)}
          className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/20"
          title="View"
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDownload(file)}
          className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(file.id)}
            disabled={isDeleting}
            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
            title="Delete"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function FileViewer({ file }) {
  const [content, setContent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    loadFileContent();
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [file.id]);

  const loadFileContent = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { blob } = await apiClient.knowledgeFiles.download(file.id);
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      // For text files, read the content
      if (file.mimeType === 'text/plain' || file.mimeType === 'text/csv') {
        const text = await blob.text();
        setContent(text);
      }
    } catch (err) {
      console.error('Failed to load file:', err);
      setError('Failed to load file content');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-red-300">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  // Image preview
  if (file.mimeType?.includes('image')) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] p-4 overflow-auto">
        <img
          src={blobUrl}
          alt={file.originalName}
          className="max-w-full max-h-[60vh] object-contain rounded"
        />
      </div>
    );
  }

  // PDF preview
  if (file.mimeType === 'application/pdf') {
    return (
      <iframe
        src={blobUrl}
        className="w-full h-full min-h-[500px]"
        title={file.originalName}
      />
    );
  }

  // Text/CSV preview
  if (file.mimeType === 'text/plain' || file.mimeType === 'text/csv') {
    return (
      <div className="h-full min-h-[300px] overflow-auto p-4">
        <pre className="text-sm text-blue-100 whitespace-pre-wrap font-mono">
          {content}
        </pre>
      </div>
    );
  }

  // For other file types (Word, Excel), show a message
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-blue-300 p-8 text-center">
      {getFileIcon(file.mimeType, 12)}
      <p className="mt-4 text-lg font-medium text-white">{file.originalName}</p>
      <p className="mt-2 text-sm">
        This file type cannot be previewed in the browser.
      </p>
      <p className="text-sm text-blue-400">
        Please download the file to view its contents.
      </p>
    </div>
  );
}
