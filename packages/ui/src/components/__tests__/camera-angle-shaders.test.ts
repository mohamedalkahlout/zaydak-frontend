import { describe, expect, it } from "vitest"
import { PROGRAMS } from "../camera-angle-shaders"

/**
 * The one thing jsdom can never tell you about a shader.
 *
 * A uniform added to the GLSL and forgotten in the JS compiles fine, renders
 * black, and fails no test — there is no WebGL in the test environment and no
 * browser in CI, so the widget would be broken on a real GPU and green here.
 * Walking `PROGRAMS` closes the specific gap that a type checker cannot: GLSL
 * is a string, and nothing else in this package reads it.
 */

/** Injected into every `ShaderMaterial` by three.js, so never ours to supply. */
const BUILTIN_UNIFORMS = new Set([
  "cameraPosition",
  "modelMatrix",
  "viewMatrix",
  "projectionMatrix",
  "normalMatrix",
  "modelViewMatrix",
])

const declarations = (src: string, keyword: string) =>
  [...src.matchAll(new RegExp(`^\\s*${keyword}\\s+\\w+\\s+(\\w+)\\s*;`, "gm"))].map(
    (m) => m[1]!,
  )

describe("camera-angle shader programs", () => {
  it("covers every program the scene mounts", () => {
    expect(PROGRAMS.map((p) => p.name)).toEqual([
      "ring",
      "glass",
      "wire",
      "beam",
      "disc",
      "pulse",
    ])
  })

  it.each(PROGRAMS.map((p) => [p.name, p] as const))(
    "%s supplies every uniform its GLSL declares",
    (_name, program) => {
      const declared = new Set(
        [
          ...declarations(program.vert, "uniform"),
          ...declarations(program.frag, "uniform"),
        ].filter((u) => !BUILTIN_UNIFORMS.has(u)),
      )
      const supplied = new Set(Object.keys(program.uniforms()))

      expect([...declared].filter((u) => !supplied.has(u))).toEqual([])
      // The other direction is only waste, not breakage — but it is still a
      // sign the two halves have drifted, so it is pinned too.
      expect([...supplied].filter((u) => !declared.has(u))).toEqual([])
    },
  )

  it.each(PROGRAMS.map((p) => [p.name, p] as const))(
    "%s writes every varying its fragment shader reads",
    (_name, program) => {
      const written = new Set(declarations(program.vert, "varying"))
      const read = declarations(program.frag, "varying")
      expect(read.filter((v) => !written.has(v))).toEqual([])
    },
  )

  it.each(PROGRAMS.map((p) => [p.name, p] as const))(
    "%s gives every uniform a defined value",
    (_name, program) => {
      for (const [key, uniform] of Object.entries(program.uniforms())) {
        expect(uniform, key).toHaveProperty("value")
        expect(uniform.value, key).not.toBeUndefined()
        expect(uniform.value, key).not.toBeNull()
      }
    },
  )

  it("writes to gl_Position and gl_FragColor exactly where it should", () => {
    for (const program of PROGRAMS) {
      expect(program.vert, program.name).toContain("gl_Position")
      expect(program.frag, program.name).toContain("gl_FragColor")
    }
  })

  it("declares the ring's two custom attributes, and no others anywhere", () => {
    // `position`, `normal` and `uv` come from three.js; anything else has to be
    // set on the geometry by hand, and only the ring's tube does that.
    for (const program of PROGRAMS) {
      const attrs = declarations(program.vert, "attribute")
      expect(attrs, program.name).toEqual(
        program.name === "ring" ? ["aOffset", "aAngle"] : [],
      )
    }
  })
})
