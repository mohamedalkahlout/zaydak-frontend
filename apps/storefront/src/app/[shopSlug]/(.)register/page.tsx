import { InAppAuthArrival } from "@/features/auth/components/in-app-auth-arrival"

/** Client-side navigations only. A cold load still renders `register/page.tsx`. */
export default function InterceptedRegisterPage() {
  return <InAppAuthArrival />
}
