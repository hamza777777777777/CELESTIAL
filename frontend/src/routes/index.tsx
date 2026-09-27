import { useState, useEffect } from "react"
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router"
import { LandingPage } from "@/components/landing/LandingPage"
import { ResortEntryExperience } from "@/components/entry/ResortEntryExperience"
import { AuthService, type AuthUser } from "@/lib/auth"
import { useRoleStore } from "@/stores/role-store"
import { getDefaultRouteForRole } from "@/config/role-permissions"

export const Route = createFileRoute("/")({
  component: RootIndexComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      view: (search?.view as string) || "",
    }
  },
})

function RootIndexComponent() {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const { setRole } = useRoleStore()

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() =>
    AuthService.getCurrentUser()
  )
  const [hasEntered, setHasEntered] = useState<boolean>(() => {
    return (
      (Boolean(AuthService.getCurrentUser()) || AuthService.isAuthenticated()) &&
      sessionStorage.getItem("resort_entered") === "true"
    )
  })

  useEffect(() => {
    const unsubscribe = AuthService.subscribeToAuthState((user) => {
      setCurrentUser(user)
      if (user) {
        setRole(user.role)
      } else {
        setHasEntered(false)
        sessionStorage.removeItem("resort_entered")
      }
    })
    return () => unsubscribe()
  }, [setRole])

  useEffect(() => {
    if (currentUser && hasEntered) {
      const target = getDefaultRouteForRole(currentUser.role)
      navigate({ to: target, replace: true })
    }
  }, [currentUser, hasEntered, navigate])

  const search = routerState.location.search as Record<string, string> | undefined
  const isLoginView =
    search?.view === "login" ||
    (typeof window !== "undefined" && window.location.search.includes("view=login"))

  if (currentUser && hasEntered) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D8CFF]" />
      </div>
    )
  }

  if (!isLoginView) {
    return (
      <div className="resort-auth-theme bg-background text-foreground min-h-screen">
        <LandingPage
          onEnter={() => {
            navigate({ to: "/", search: { view: "login" } })
          }}
        />
      </div>
    )
  }

  return (
    <div className="resort-auth-theme bg-background text-foreground relative w-full min-h-screen overflow-hidden">
      <div
        id="dashboard-reveal-container"
        className="w-full min-h-screen will-change-transform"
        style={{ transform: "translateY(100%)", visibility: "hidden" }}
      />
      <div className="fixed inset-0 z-50">
        <ResortEntryExperience
          initialView="login"
          onEntered={() => {
            sessionStorage.setItem("resort_entered", "true")
            setHasEntered(true)
            const role = AuthService.getCurrentUser()?.role
            const target = getDefaultRouteForRole(role)
            navigate({ to: target, replace: true })
          }}
        />
      </div>
    </div>
  )
}
