import { type Role } from '@/stores/role-store'

/**
 * Route URLs permitted for each user role.
 * Enforces strict Role-Based Access Control (RBAC).
 */
export const ROLE_ALLOWED_ROUTES: Record<Role, string[]> = {
  Guest: [
    '/recommendations',
    '/booking-occupancy',
    '/complaints',
  ],
  Staff: [
    '/dashboard',
    '/resort-360',
    '/tasks',
    '/staff',
  ],
  'Team Head': [
    '/dashboard',
    '/resort-360',
    '/complaints',
    '/tasks',
    '/staff',
    '/verification',
    '/recommendations',
    '/booking-occupancy',
    '/cancellation-risk',
  ],
  Manager: [
    '/dashboard',
    '/resort-360',
    '/complaints',
    '/tasks',
    '/staff',
    '/verification',
    '/recommendations',
    '/booking-occupancy',
    '/pricing',
    '/cancellation-risk',
    '/insights',
    '/audit',
    '/settings',
  ],
}

/**
 * Default landing route for each role after successful authentication.
 */
export const ROLE_DEFAULT_ROUTE: Record<Role, string> = {
  Guest: '/recommendations',
  Staff: '/tasks',
  'Team Head': '/resort-360',
  Manager: '/resort-360',
}

/**
 * Check whether a pathname is allowed for a given role.
 */
export function isRouteAllowedForRole(role: Role | undefined | null, pathname: string): boolean {
  const activeRole: Role = role && ROLE_ALLOWED_ROUTES[role] ? role : 'Guest'
  const allowed = ROLE_ALLOWED_ROUTES[activeRole] || []
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return allowed.includes(normalized)
}

/**
 * Get the default route to redirect to for a given role.
 */
export function getDefaultRouteForRole(role: Role | undefined | null): string {
  const activeRole: Role = role && ROLE_DEFAULT_ROUTE[role] ? role : 'Guest'
  return ROLE_DEFAULT_ROUTE[activeRole] || '/recommendations'
}
