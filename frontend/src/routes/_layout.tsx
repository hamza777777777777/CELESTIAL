import { Outlet, createFileRoute, redirect, useLocation, useNavigate } from "@tanstack/react-router"
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout"
import { AuthService } from "@/lib/auth"
import { useRoleStore } from "@/stores/role-store"
import { isRouteAllowedForRole, getDefaultRouteForRole } from "@/config/role-permissions"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

import { useEffect } from "react"

export const Route = createFileRoute("/_layout")({
  beforeLoad: () => {
    if (!AuthService.isAuthenticated()) {
      throw redirect({ to: "/", search: { view: "login" } })
    }
  },
  component: LayoutComponent,
})

function LayoutComponent() {
  const { currentRole } = useRoleStore()
  const effectiveRole = currentRole || AuthService.getCurrentUser()?.role || "Guest"
  const location = useLocation()
  const navigate = useNavigate()

  const isAllowed = isRouteAllowedForRole(effectiveRole, location.pathname)

  useEffect(() => {
    if (!isAllowed) {
      navigate({ to: getDefaultRouteForRole(effectiveRole) as any, replace: true })
    }
  }, [isAllowed, effectiveRole, navigate])

  if (!isAllowed) {
    return (
      <AuthenticatedLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-4">
          <div className="p-4 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
            <ShieldAlert className="size-12" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Access Restricted</h2>
          <p className="text-muted-foreground max-w-md">
            Your current role (<span className="font-semibold text-foreground">{currentRole}</span>) does not have permission to view <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">{location.pathname}</code>.
          </p>
          <Button
            onClick={() => navigate({ to: getDefaultRouteForRole(currentRole) as any })}
            className="mt-2"
          >
            Return to Allowed Dashboard
          </Button>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <Outlet />
    </AuthenticatedLayout>
  )
}
