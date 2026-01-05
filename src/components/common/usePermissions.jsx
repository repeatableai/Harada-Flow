import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export const usePermissions = () => {
  // First, get the current user
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false, // Don't retry on auth errors
    onError: (error) => {
      // If we get a 404 or "not found" error, it might be a localhost configuration issue
      if (error?.message?.includes('404') || error?.message?.includes('not found')) {
        console.warn('Base44 authentication error. If running on localhost, make sure localhost:5173 is configured in Base44 app settings.');
      }
    },
  });

  // Then, based on the user's role_id, get their role and permissions
  const { data: role, isLoading: isLoadingRole } = useQuery({
    queryKey: ['userRole', user?.role_id],
    queryFn: async () => {
      if (!user?.role_id) {
        return null; // User has no role assigned
      }
      // Since we are fetching by ID, and it's unique, we get the first item from the list.
      const roles = await base44.entities.Role.filter({ id: user.role_id }, '', 1);
      return roles.length > 0 ? roles[0] : null;
    },
    enabled: !!user && !!user.role_id, // Only run this query if we have a user with a role_id
  });

  const permissions = role?.permissions || [];
  const hasPermission = (permissionKey) => permissions.includes(permissionKey);

  return {
    user,
    role,
    permissions,
    hasPermission,
    isLoading: isLoadingUser || isLoadingRole,
  };
};