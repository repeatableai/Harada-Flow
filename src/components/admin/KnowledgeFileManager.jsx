import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Search,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  Trash2,
  File,
  FileText,
  FileSpreadsheet,
  Image,
  Loader2,
  FolderOpen,
  User,
  Building2,
  Globe,
  Filter,
  X,
  AlertTriangle,
} from 'lucide-react';

const SCOPE_OPTIONS = [
  { value: 'self', label: 'Personal', description: 'Only you can see this file', icon: User, color: 'gray' },
  { value: 'departments', label: 'Specific Departments', description: 'Selected departments can see this file', icon: FolderOpen, color: 'green' },
  { value: 'company', label: 'Company-wide', description: 'All employees in your company can see this file', icon: Building2, color: 'blue' },
];

const SCOPE_COLORS = {
  self: 'border-gray-400 text-gray-300 bg-gray-500/10',
  departments: 'border-green-400 text-green-300 bg-green-500/10',
  company: 'border-blue-400 text-blue-300 bg-blue-500/10',
  system: 'border-purple-400 text-purple-300 bg-purple-500/10',
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mimeType) => {
  if (mimeType?.includes('pdf')) return <FileText className="w-5 h-5 text-red-400" />;
  if (mimeType?.includes('word') || mimeType?.includes('document')) return <FileText className="w-5 h-5 text-blue-400" />;
  if (mimeType?.includes('sheet') || mimeType?.includes('excel') || mimeType?.includes('csv')) return <FileSpreadsheet className="w-5 h-5 text-green-400" />;
  if (mimeType?.includes('image')) return <Image className="w-5 h-5 text-purple-400" />;
  return <File className="w-5 h-5 text-gray-400" />;
};

// Group files by organization for super admin view
const groupFilesByOrganization = (filesData) => {
  const grouped = {};
  filesData?.forEach(file => {
    const orgName = file.organization?.name || 'System Files';
    const orgId = file.organization?.id || 'system';
    if (!grouped[orgId]) {
      grouped[orgId] = {
        name: orgName,
        files: []
      };
    }
    grouped[orgId].files.push(file);
  });
  // Sort by organization name, with System Files at the end
  return Object.entries(grouped).sort((a, b) => {
    if (a[0] === 'system') return 1;
    if (b[0] === 'system') return -1;
    return a[1].name.localeCompare(b[1].name);
  });
};

export default function KnowledgeFileManager() {
  const { user, isAdmin, isCompanyAdmin, isSuperAdmin, organization, department } = useAuth();

  const [files, setFiles] = useState({ data: [], pagination: {} });
  const [departments, setDepartments] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Upload dialog state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadScope, setUploadScope] = useState('self');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [uploadDescription, setUploadDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Permission helpers
  const canUploadToScope = (scope) => {
    if (scope === 'self') return true;
    return isAdmin(); // DEPARTMENT_ADMIN and above can upload to departments and company
  };

  const canDelete = (file) => {
    if (isSuperAdmin()) return true;
    return file.uploaderId === user?.id;
  };

  useEffect(() => {
    loadFiles(1);
    // Load organizations for Super Admin
    if (isSuperAdmin()) {
      loadOrganizations();
    }
  }, []);

  // Load departments when organization becomes available (for non-Super Admin)
  useEffect(() => {
    if (!isSuperAdmin() && organization?.id) {
      loadDepartments(organization.id);
    }
  }, [organization?.id]);

  // Load departments when Super Admin selects an organization
  useEffect(() => {
    if (isSuperAdmin() && selectedOrgId) {
      loadDepartments(selectedOrgId);
    }
  }, [selectedOrgId]);

  const loadOrganizations = async () => {
    try {
      const result = await apiClient.organizations.list({ limit: 100 });
      setOrganizations(result.data || []);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    }
  };

  const loadFiles = async (pageNum, search = searchQuery, scope = scopeFilter) => {
    setIsLoading(true);
    try {
      const result = await apiClient.knowledgeFiles.list({
        page: pageNum,
        limit: 20,
        search: search || undefined,
        scope: scope !== 'all' ? scope : undefined,
      });
      setFiles(result);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepartments = async (orgId) => {
    if (!orgId) return;
    try {
      const result = await apiClient.departments.list(orgId, { limit: 100 });
      setDepartments(result.data || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
      setDepartments([]);
    }
  };

  const handleSearch = () => {
    loadFiles(1, searchQuery, scopeFilter);
  };

  const handleScopeFilterChange = (value) => {
    setScopeFilter(value);
    loadFiles(1, searchQuery, value);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('File too large. Maximum size is 10MB');
        return;
      }
      setUploadFile(file);
      setUploadError('');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('File too large. Maximum size is 10MB');
        return;
      }
      setUploadFile(file);
      setUploadError('');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError('Please select a file');
      return;
    }

    // Super Admin must select an organization for company/departments scope
    if (isSuperAdmin() && uploadScope !== 'self' && !selectedOrgId) {
      setUploadError('Please select a company first');
      return;
    }

    if (uploadScope === 'departments' && selectedDepts.length === 0) {
      setUploadError('Please select at least one department');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      // Determine the organization ID to use
      const orgId = isSuperAdmin() ? selectedOrgId : organization?.id;

      await apiClient.knowledgeFiles.upload(
        uploadFile,
        uploadScope,
        uploadScope === 'departments' ? selectedDepts : [],
        uploadDescription,
        uploadScope !== 'self' ? orgId : null // Only send orgId for non-personal files
      );
      setShowUploadDialog(false);
      resetUploadForm();
      loadFiles(1);
    } catch (error) {
      setUploadError(error.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (file) => {
    try {
      const { blob, filename } = await apiClient.knowledgeFiles.download(file.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      await apiClient.knowledgeFiles.delete(selectedFile.id);
      setShowDeleteDialog(false);
      setSelectedFile(null);
      loadFiles(page);
    } catch (error) {
      setDeleteError(error.message || 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  };

  const openUploadDialog = () => {
    resetUploadForm();
    setShowUploadDialog(true);
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadScope('self');
    setSelectedOrgId('');
    setSelectedDepts([]);
    setDepartments([]);
    setUploadDescription('');
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openDeleteDialog = (file) => {
    setSelectedFile(file);
    setDeleteError('');
    setShowDeleteDialog(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const toggleDepartment = (deptId) => {
    setSelectedDepts(prev =>
      prev.includes(deptId)
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    );
  };

  // Get available scopes based on user role
  const getAvailableScopes = () => {
    if (isAdmin()) {
      return SCOPE_OPTIONS;
    }
    return SCOPE_OPTIONS.filter(s => s.value === 'self');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-purple-400" />
            Knowledge Files
          </h3>
          <p className="text-blue-300 text-sm">
            Upload and manage shared knowledge files
          </p>
        </div>
        <Button onClick={openUploadDialog} className="bg-purple-600 hover:bg-purple-700">
          <Upload className="w-4 h-4 mr-2" />
          Upload File
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search by filename..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="bg-white/10 border-white/20 text-white placeholder-blue-300 flex-1 min-w-[200px]"
        />
        <Select value={scopeFilter} onValueChange={handleScopeFilterChange}>
          <SelectTrigger className="w-[160px] bg-white/10 border-white/20 text-white">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Files</SelectItem>
            <SelectItem value="self">Personal</SelectItem>
            <SelectItem value="departments">Departments</SelectItem>
            <SelectItem value="company">Company-wide</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Files Table */}
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
                    <th className="text-left p-4 text-blue-200 font-medium">File</th>
                    <th className="text-left p-4 text-blue-200 font-medium">Size</th>
                    <th className="text-left p-4 text-blue-200 font-medium">Scope</th>
                    <th className="text-left p-4 text-blue-200 font-medium">Uploaded By</th>
                    <th className="text-left p-4 text-blue-200 font-medium">Date</th>
                    <th className="text-right p-4 text-blue-200 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Super Admin: Show files grouped by company */}
                  {isSuperAdmin() && files.data?.length > 0 ? (
                    groupFilesByOrganization(files.data).map(([orgId, orgData]) => (
                      <React.Fragment key={orgId}>
                        {/* Company Section Header */}
                        <tr className="bg-white/5">
                          <td colSpan="6" className="p-3">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-purple-400" />
                              <span className="text-purple-300 font-semibold">{orgData.name}</span>
                              <Badge variant="outline" className="border-purple-400/50 text-purple-300 text-xs ml-2">
                                {orgData.files.length} {orgData.files.length === 1 ? 'file' : 'files'}
                              </Badge>
                            </div>
                          </td>
                        </tr>
                        {/* Files for this company */}
                        {orgData.files.map((file) => (
                          <tr key={file.id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="p-4 pl-8">
                              <div className="flex items-center gap-3">
                                {getFileIcon(file.mimeType)}
                                <div>
                                  <p className="text-white font-medium truncate max-w-[200px]" title={file.originalName}>
                                    {file.originalName}
                                  </p>
                                  {file.description && (
                                    <p className="text-blue-300 text-xs truncate max-w-[200px]" title={file.description}>
                                      {file.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-blue-300 text-sm">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="p-4">
                              <Badge variant="outline" className={SCOPE_COLORS[file.scope]}>
                                {file.scope === 'self' && 'Personal'}
                                {file.scope === 'departments' && 'Departments'}
                                {file.scope === 'company' && 'Company'}
                                {file.scope === 'system' && 'System'}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <p className="text-white text-sm">{file.uploader?.name || 'Unknown'}</p>
                              <p className="text-blue-300 text-xs">{file.uploader?.email}</p>
                            </td>
                            <td className="p-4 text-blue-300 text-sm">
                              {formatDate(file.createdAt)}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDownload(file)}
                                  className="text-blue-300 hover:text-white hover:bg-white/10"
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                {canDelete(file) && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openDeleteDialog(file)}
                                    className="text-red-300 hover:text-white hover:bg-red-500/10"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  ) : (
                    /* Non-Super Admin: Show flat file list */
                    files.data?.map((file) => (
                      <tr key={file.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {getFileIcon(file.mimeType)}
                            <div>
                              <p className="text-white font-medium truncate max-w-[200px]" title={file.originalName}>
                                {file.originalName}
                              </p>
                              {file.description && (
                                <p className="text-blue-300 text-xs truncate max-w-[200px]" title={file.description}>
                                  {file.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-blue-300 text-sm">
                          {formatFileSize(file.size)}
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className={SCOPE_COLORS[file.scope]}>
                            {file.scope === 'self' && 'Personal'}
                            {file.scope === 'departments' && 'Departments'}
                            {file.scope === 'company' && 'Company'}
                            {file.scope === 'system' && 'System'}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <p className="text-white text-sm">{file.uploader?.name || 'Unknown'}</p>
                          <p className="text-blue-300 text-xs">{file.uploader?.email}</p>
                        </td>
                        <td className="p-4 text-blue-300 text-sm">
                          {formatDate(file.createdAt)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownload(file)}
                              className="text-blue-300 hover:text-white hover:bg-white/10"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            {canDelete(file) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openDeleteDialog(file)}
                                className="text-red-300 hover:text-white hover:bg-red-500/10"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                  {(!files.data || files.data.length === 0) && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-blue-300">
                        No files found. Upload files to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {files.pagination?.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-white/10">
              <p className="text-blue-300 text-sm">
                Page {files.pagination.page} of {files.pagination.totalPages}
                {files.pagination.total && ` (${files.pagination.total} total)`}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadFiles(page - 1)}
                  disabled={page <= 1}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadFiles(page + 1)}
                  disabled={page >= files.pagination.totalPages}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-400" />
              Upload Knowledge File
            </DialogTitle>
            <DialogDescription>
              Upload a file to share with your team
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {uploadError && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                {uploadError}
              </div>
            )}

            {/* File Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                uploadFile
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/20 hover:border-white/40 hover:bg-white/5'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
              />
              {uploadFile ? (
                <div className="flex items-center justify-center gap-3">
                  {getFileIcon(uploadFile.type)}
                  <div className="text-left">
                    <p className="text-white font-medium">{uploadFile.name}</p>
                    <p className="text-blue-300 text-sm">{formatFileSize(uploadFile.size)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-red-300 hover:text-white hover:bg-red-500/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <FolderOpen className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                  <p className="text-white">Drop file here or click to browse</p>
                  <p className="text-blue-300 text-sm mt-1">
                    PDF, DOC, DOCX, TXT, CSV, XLSX, PNG, JPG, GIF (max 10MB)
                  </p>
                </div>
              )}
            </div>

            {/* Organization Selection (Super Admin only) */}
            {isSuperAdmin() && (
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-400" />
                  Select Company {uploadScope !== 'self' && <span className="text-red-400">*</span>}
                </Label>
                <Select
                  value={selectedOrgId}
                  onValueChange={(value) => {
                    setSelectedOrgId(value);
                    setSelectedDepts([]);
                  }}
                >
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Select a company..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {uploadScope !== 'self' && !selectedOrgId && (
                  <p className="text-blue-300 text-xs">
                    Required for company-wide or department files
                  </p>
                )}
              </div>
            )}

            {/* Scope Selection */}
            <div className="space-y-2">
              <Label className="text-white">Who can access this file?</Label>
              <div className="space-y-2">
                {getAvailableScopes().map((scope) => (
                  <label
                    key={scope.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      uploadScope === scope.value
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                    onClick={() => setUploadScope(scope.value)}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={scope.value}
                      checked={uploadScope === scope.value}
                      onChange={() => setUploadScope(scope.value)}
                      className="mt-1"
                    />
                    <scope.icon className={`w-5 h-5 mt-0.5 text-${scope.color}-400`} />
                    <div>
                      <p className="text-white font-medium">{scope.label}</p>
                      <p className="text-blue-300 text-sm">
                        {scope.value === 'self'
                          ? scope.description
                          : isSuperAdmin() && selectedOrgId
                            ? scope.description.replace('your company', organizations.find(o => o.id === selectedOrgId)?.name || 'the selected company')
                            : scope.description
                        }
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Department Selection (when scope is 'departments') */}
            {uploadScope === 'departments' && (
              <div className="space-y-2">
                <Label className="text-white">Select Departments</Label>
                <div className="max-h-40 overflow-y-auto space-y-2 p-3 bg-white/5 rounded-lg">
                  {isSuperAdmin() && !selectedOrgId ? (
                    <p className="text-blue-300 text-sm">
                      Please select a company first
                    </p>
                  ) : departments.length > 0 ? (
                    departments.map((dept) => (
                      <label
                        key={dept.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedDepts.includes(dept.id)}
                          onCheckedChange={() => toggleDepartment(dept.id)}
                        />
                        <span className="text-white">{dept.name}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-blue-300 text-sm">
                      {(isSuperAdmin() ? selectedOrgId : organization?.id) ? 'Loading departments...' : 'No departments available'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-white">Description (optional)</Label>
              <Textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Brief description of the file..."
                className="bg-white/10 border-white/20 text-white placeholder-blue-300/50 resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setShowUploadDialog(false)}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !uploadFile}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Delete File
            </AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300">
              Are you sure you want to delete <span className="text-white font-medium">{selectedFile?.originalName}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
              {deleteError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete File'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
