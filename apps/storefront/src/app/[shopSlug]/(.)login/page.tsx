import { InAppAuthArrival } from "@/features/auth/components/in-app-auth-arrival"

/** Client-side navigations only. A cold load still renders `login/page.tsx`. */
export default function InterceptedLoginPage() {
  return <InAppAuthArrival />
}
