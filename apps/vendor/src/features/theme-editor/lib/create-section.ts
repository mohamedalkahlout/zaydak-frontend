import type {
  StoreSectionInstance,
  StoreSectionType,
} from "../types"
import { defaultSettingsFor } from "./section-registry"

export function createSectionId(type: StoreSectionType): string {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `sec_${type}_${suffix}`
}

export function createSection(type: StoreSectionType): StoreSectionInstance {
  const id = createSectionId(type)
  return {
    id,
    type,
    disabled: false,
    settings: { ...defaultSettingsFor(type) },
  }
}

export function cloneLayout<T>(value: T): T {
  return structuredClone(value)
}

export function layoutsEqual(
  a: { order: string[]; sections: Record<string, StoreSectionInstance> },
  b: { order: string[]; sections: Record<string, StoreSectionInstance> },
): boolean {
  return JSON.stringify({ order: a.order, sections: a.sections }) ===
    JSON.stringify({ order: b.order, sections: b.sections })
}
