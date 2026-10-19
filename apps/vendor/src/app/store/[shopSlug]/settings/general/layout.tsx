import { GeneralFormProvider } from "@/features/settings"

/**
 * General, Store contact details and Brand are three URLs editing **one**
 * `updateShop` call, so the form lives here — in the layout they share — and
 * survives navigation between them. One set of unsaved changes, one Save in
 * the navbar.
 *
 * Leaving the group unmounts this, and the edit with it, so the provider arms
 * a leave guard while the form is dirty: an exit to another section, the
 * overlay's X or Escape, or a reload is confirmed first, and a move between
 * these three URLs is not — the form is still mounted on the other side.
 */
export default function GeneralLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <GeneralFormProvider>{children}</GeneralFormProvider>
}
