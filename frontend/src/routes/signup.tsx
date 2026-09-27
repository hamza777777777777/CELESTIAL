import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

export const Route = createFileRoute("/signup")({
  component: SignupRedirect,
})

function SignupRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    // Redirect /signup to /?view=login — the ResortAuthCard has a Register tab
    navigate({ to: "/", search: { view: "login" }, replace: true })
  }, [navigate])

  return null
}
