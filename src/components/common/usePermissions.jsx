import { useAuth } from '@/components/auth/AuthProvider';

export const usePermissions = () => {
  const { user } = useAuth();

  // All authenticated users can start new roles
  // Admins and super admins have all permissions
  const isAdmin = user && (
    user.role === 'ADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    user.userType === 'superadmin'
  );

  const permissions = isAdmin
    ? ['can_start_new_role', 'can_view_all_users', 'can_view_all_companies']
    : ['can_start_new_role'];

  const hasPermission = (permissionKey) => permissions.includes(permissionKey);

  return {
    user,
    role: user ? { permissions } : null,
    permissions,
    hasPermission,
    isLoading: false, // User is always available from context when authenticated
  };
};
