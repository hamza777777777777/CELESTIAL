import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

export const Route = createFileRoute("/login")({
  component: LoginRedirect,
})

function LoginRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    // Redirect /login to /?view=login which shows the ResortEntryExperience
    navigate({ to: "/", search: { view: "login" }, replace: true })
  }, [navigate])

  return null
}
