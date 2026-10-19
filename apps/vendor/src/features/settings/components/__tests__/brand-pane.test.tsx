import { describe, it, expect, vi, beforeAll } from "vitest"
import type { Context } from "react"
import { useForm, useFormState, useWatch, type UseFormReturn } from "react-hook-form"
import { render, screen, fireEvent } from "@testing-library/react"
import { brandDefaults } from "../../lib/brand"
import type { FileEntry } from "@/features/files/types"
import type { GeneralValues, SettingsShop } from "../../types"

/**
 * The Brand pane's Logos card footer.
 *
 * It used to link to the media library in a new tab — the only safe exit from
 * a screen whose staged edit lives in the route group's layout, since
 * navigating this tab unmounts the form. It now opens the same picker the
 * slot's plus menu does, in place, and what it picks is **staged** rather
 * than saved. These pin the in-place part: nothing leaves the page, the pick
 * lands on `logo` and dirties the form, and the strip goes once there is one.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn() },
}))

// The upload hook reads the auth and active-shop stores and posts to
// `/attachments`; the slots only need it to exist. The MIME constants stay
// real so the accept lists under test are the ones production uses.
vi.mock("@/shared/lib/upload/use-attachment-upload", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/shared/lib/upload/use-attachment-upload")
  >()),
  useAttachmentUpload: () => ({
    uploadFiles: vi.fn(async () => []),
    uploading: false,
    progress: 0,
    error: null,
    reset: () => {},
  }),
}))

// The picker is a dialog over its own query. Here it is one button that hands
// back a library row with no thumbnail — the shape that would break Save if
// the mapping forgot the fallback — so a pick is a click.
vi.mock("@/features/files/components/media-library-picker", () => ({
  MediaLibraryPicker: ({
    open,
    onPick,
    onOpenChange,
  }: {
    open: boolean
    onPick: (file: FileEntry) => void
    onOpenChange: (open: boolean) => void
  }) =>
    open ? (
      <div data-testid="library-open">
        <button
          type="button"
          onClick={() => {
            onPick({
              id: "f1",
              filename: "o.png",
              original_name: "o.png",
              mime_type: "image/png",
              size: 1,
              url: "https://cdn/o.png",
              thumbnail: null,
              alt: null,
              context: "files",
              created_at: "",
              updated_at: "",
            })
            onOpenChange(false)
          }}
        >
          pick
        </button>
      </div>
    ) : null,
}))

// The provider owns the mutation and the save bar; the pane only needs the
// form it hands out. A context of our own lets the harness supply a real
// `useForm`, so staging is observable through react-hook-form itself rather
// than through a spy on `setValue`.
vi.mock("../general-form-provider", async () => {
  const React = await import("react")
  const TestFormContext = React.createContext<unknown>(null)
  return {
    TestFormContext,
    useGeneralForm: () => React.useContext(TestFormContext),
  }
})

const { BrandPane } = await import("../brand-pane")
const { TestFormContext } = (await import("../general-form-provider")) as unknown as {
  TestFormContext: Context<{
    shop: SettingsShop
    form: UseFormReturn<GeneralValues>
  } | null>
}

const IMAGE = { id: "img-1", original: "https://cdn/o.png", thumbnail: "https://cdn/t.png" }

function shop(overrides: Partial<SettingsShop> = {}): SettingsShop {
  return {
    id: "shop-1",
    name: "Acme",
    slug: "acme",
    is_active: true,
    is_approved: true,
    ...overrides,
  }
}

/** `buildDefaults` lives in the mocked module, so the same shape is built here. */
function values(s: SettingsShop): GeneralValues {
  return {
    name: s.name,
    contact: "",
    email: "",
    website: "",
    formattedAddress: "",
    apartment: "",
    company: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    ...brandDefaults(s),
  }
}

/**
 * Renders the pane over a real form and echoes the staged logo and the dirty
 * flag into the DOM, rather than handing the form object out to the test —
 * which would be a write from render into module scope.
 */
function Harness({ shop: s }: { shop: SettingsShop }) {
  const form = useForm<GeneralValues>({ defaultValues: values(s) })
  return (
    <TestFormContext.Provider value={{ shop: s, form }}>
      <BrandPane />
      <Staged form={form} />
    </TestFormContext.Provider>
  )
}

function Staged({ form }: { form: UseFormReturn<GeneralValues> }) {
  const logo = useWatch({ control: form.control, name: "logo" })
  const { isDirty } = useFormState({ control: form.control })
  return (
    <output data-testid="staged">{JSON.stringify({ logo, dirty: isDirty })}</output>
  )
}

const staged = () => JSON.parse(screen.getByTestId("staged").textContent ?? "null")

beforeAll(() => {
  // Base UI's popover and menu position with floating-ui, which measures the
  // anchor; jsdom ships no ResizeObserver.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

describe("BrandPane — the Logos footer", () => {
  it("opens the library in place rather than linking out of the page", () => {
    const { container } = render(<Harness shop={shop()} />)

    expect(screen.getByText("No logo yet?")).toBeTruthy()
    expect(container.querySelector("a[target=_blank]")).toBeNull()
    expect(screen.queryByTestId("library-open")).toBeNull()

    fireEvent.click(
      screen.getByRole("button", { name: "Pick one from your media library" }),
    )

    expect(screen.getByTestId("library-open")).toBeTruthy()
    // Opening a dialog is not an edit: no save bar yet.
    expect(staged()).toEqual({ logo: null, dirty: false })
  })

  it("stages the pick as the default logo, then drops the strip", () => {
    render(<Harness shop={shop()} />)

    fireEvent.click(
      screen.getByRole("button", { name: "Pick one from your media library" }),
    )
    fireEvent.click(screen.getByText("pick"))

    expect(staged()).toEqual({
      logo: { id: "f1", original: "https://cdn/o.png", thumbnail: "https://cdn/o.png" },
      dirty: true,
    })
    expect(screen.queryByTestId("library-open")).toBeNull()
    expect(screen.queryByText("No logo yet?")).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Pick one from your media library" }),
    ).toBeNull()
  })

  it("shows no strip for a shop that already has a default logo", () => {
    render(<Harness shop={shop({ logo: IMAGE })} />)

    expect(screen.queryByText("No logo yet?")).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Pick one from your media library" }),
    ).toBeNull()
  })
})
