"use client"

// Side-effect import: the generated registry calls `registerBones()`, which has
// to have run before any <Bones> resolves its name. It lives here rather than in
// `app/layout.tsx` (what the boneyard docs suggest) so it stays in the client
// bundle — a bare side-effect import from a server layout is evaluated during
// SSR, where `registerBones` does nothing useful.
//
// This import is the only reason this wrapper exists. The component itself is
// shared (`@repo/ui/components/bones`) because the registry is the sole
// app-local part; the measurement logic is identical in both consoles.
import "@/bones/registry"

export { Bones, type BonesProps } from "@repo/ui/components/bones"
