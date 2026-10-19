import { AppLogo } from "@/shared/components/app-logo";

/**
 * The brand lockup in `AuthShell`'s brand slot — used by the signup wizard
 * and the OTP sign-in screen.
 */
export function SignupBrand() {
  return <AppLogo variant="desktop" size="xl" href={null} />;
}
