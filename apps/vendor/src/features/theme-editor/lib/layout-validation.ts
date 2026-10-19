import type { StoreLayoutDocument, StoreSectionInstance } from "../types"
import { SECTION_REGISTRY } from "./section-registry"

export function orderedSections(
  layout: StoreLayoutDocument,
): StoreSectionInstance[] {
  return layout.order
    .map((id) => layout.sections[id])
    .filter((section): section is StoreSectionInstance => Boolean(section))
}

export function existingTypes(layout: StoreLayoutDocument) {
  return orderedSections(layout).map((section) => section.type)
}

export function canRemove(section: StoreSectionInstance): boolean {
  return SECTION_REGISTRY[section.type].removable
}

export function canDuplicate(section: StoreSectionInstance): boolean {
  return SECTION_REGISTRY[section.type].duplicable
}
