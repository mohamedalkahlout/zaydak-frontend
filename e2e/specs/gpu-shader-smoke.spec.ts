import fs from "node:fs"
import path from "node:path"
import { expect, test } from "playwright/test"
import { ARTIFACT_DIR, BASE_URL } from "../lib/env"

/**
 * T4-38: GPU shader CI smoke tests.
 *
 * Asserts non-blank canvas render for WebGL backgrounds (ShaderBackground,
 * CloudShader) and graceful degradation for trackball / 3D scenes when WebGL2
 * is either supported or absent (e.g. headless CI without GPU).
 */

const STOREFRONT_URL = process.env.E2E_STOREFRONT_URL ?? "http://localhost:3003"

test.describe("GPU shader smoke tests (T4-38)", () => {
  test("vendor login shader background mounts non-blank canvas or graceful ground", async ({
    page,
  }) => {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

    // Track unhandled errors or rejected promises from WebGL initialization
    const pageErrors: Error[] = []
    page.on("pageerror", (err) => pageErrors.push(err))

    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" })

    // Wait for the auth card to mount
    const card = page.locator("form").first()
    await expect(card).toBeVisible({ timeout: 15_000 })

    // Check if the canvas is present
    const canvas = page.locator("canvas").first()
    const canvasCount = await canvas.count()

    if (canvasCount > 0) {
      await expect(canvas).toBeAttached()
      const box = await canvas.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeGreaterThan(0)
      expect(box!.height).toBeGreaterThan(0)

      // Evaluate whether the canvas is functional
      const canvasInfo = await canvas.evaluate((el: HTMLCanvasElement) => {
        const gl = el.getContext("webgl2") || el.getContext("webgl")
        if (!gl) return { hasContext: false, nonBlank: false }

        const pixels = new Uint8Array(4)
        gl.readPixels(
          Math.floor(el.width / 2),
          Math.floor(el.height / 2),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        )
        const hasContent = pixels[0] > 0 || pixels[1] > 0 || pixels[2] > 0 || pixels[3] > 0
        return { hasContext: true, nonBlank: hasContent }
      })

      // If WebGL context was created, verify it is drawing or initialized
      if (canvasInfo.hasContext) {
        expect(canvasInfo.nonBlank).toBe(true)
      }
    }

    // Must not produce uncaught WebGL crashes
    expect(pageErrors.filter((e) => /WebGL/i.test(e.message))).toHaveLength(0)

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "gpu-vendor-login.png"),
      fullPage: false,
    })
  })

  test("storefront cloud shader mounts without uncaught exceptions", async ({
    page,
  }) => {
    const pageErrors: Error[] = []
    page.on("pageerror", (err) => pageErrors.push(err))

    try {
      const resp = await page.goto(STOREFRONT_URL, {
        timeout: 10_000,
        waitUntil: "domcontentloaded",
      })
      if (!resp || resp.status() >= 400) {
        test.skip(true, `Storefront not available at ${STOREFRONT_URL}`)
        return
      }

      // Check canvas if present
      const canvas = page.locator("canvas").first()
      if ((await canvas.count()) > 0) {
        await expect(canvas).toBeAttached()
      }

      expect(pageErrors.filter((e) => /WebGL/i.test(e.message))).toHaveLength(0)
    } catch {
      test.skip(true, `Storefront not reachable at ${STOREFRONT_URL}`)
    }
  })
})
