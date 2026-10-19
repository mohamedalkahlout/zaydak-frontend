import { notFound } from "next/navigation"
import {
  PoliciesPane,
  SectionPlaceholderPane,
  sectionIdFromSlug,
} from "@/features/settings"

/**
 * The sections named in the rail that are not built yet.
 *
 * A dynamic segment rather than sixteen identical folders — Next resolves the
 * static siblings (`general`, `plan`, `shipping`, `taxes`, `notifications`, `abandoned-carts`, `policies`, …) first, so
 * this only ever catches the rest. An unknown slug is a 404, not a placeholder:
 * `/settings/nonsense` is a wrong URL, not an unbuilt screen.
 */
export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  const id = sectionIdFromSlug(section)
  if (!id) notFound()
  if (id === "policies") return <PoliciesPane />
  return <SectionPlaceholderPane id={id} />
}
