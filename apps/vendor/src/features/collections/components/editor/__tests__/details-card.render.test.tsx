import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { useForm, useFormState, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { collectionFormDefaults } from "@/features/collections/lib/rules"
import {
  collectionFormSchema,
  type CollectionFormApi,
  type CollectionFormInput,
} from "@/features/collections/validations/shop-collection"
import {
  LangTabsBar,
  LocaleProvider,
} from "@/features/products/components/form/ui/lang-tabs"

// What the card decides, not how it looks: the alt text input exists only
// with a cover to attach it to, the title and description follow the form's
// EN/AR pill and write the locale on screen without touching the other, and
// the required-title error still surfaces whichever locale is showing.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

// The media library is an Apollo query behind a dialog; the card only opens it.
vi.mock("@/features/files/components/media-library-picker", () => ({
  MediaLibraryPicker: () => null,
}))

// `next/image` wants a configured loader and a sized parent; the cover's
// markup is not what these pin.
vi.mock("@/shared/components/app-image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

const { DetailsCard } = await import("../details-card")

/**
 * Asserted through what it renders: the harness echoes the form values it
 * cares about into the DOM rather than handing the form object out to the
 * test, which would be a write from render into module scope.
 */
function Harness({
  defaults,
  withPill,
}: {
  defaults?: Partial<CollectionFormInput>
  withPill?: boolean
}) {
  const form = useForm<CollectionFormInput>({
    // Keys echo here like everywhere else in this file; the card renders the
    // title error through its own `t`, not the schema's message.
    resolver: zodResolver(collectionFormSchema((key: string) => key)),
    defaultValues: { ...collectionFormDefaults(), ...defaults },
  }) as CollectionFormApi

  const body = (
    <>
      <DetailsCard form={form} />
      <Echo form={form} />
      <button type="button" onClick={() => void form.trigger("name")}>
        validate
      </button>
    </>
  )

  return withPill ? (
    <LocaleProvider>
      {body}
      <LangTabsBar />
    </LocaleProvider>
  ) : (
    body
  )
}

function Echo({ form }: { form: CollectionFormApi }) {
  const name = useWatch({ control: form.control, name: "name" })
  const alt = useWatch({ control: form.control, name: "image_alt" })
  const { dirtyFields } = useFormState({ control: form.control })
  return (
    <output data-testid="echo">
      {JSON.stringify({ name, alt, dirty: dirtyFields })}
    </output>
  )
}

const echo = () =>
  JSON.parse(screen.getByTestId("echo").textContent ?? "{}") as {
    name: { en?: string; ar?: string }
    alt?: string
    dirty: Record<string, unknown>
  }

const titleInput = () =>
  screen.getByPlaceholderText("details.addTitle") as HTMLInputElement

const descriptionInput = () =>
  screen.getByPlaceholderText("details.addDescription") as HTMLTextAreaElement

describe("DetailsCard", () => {
  it("offers no alt text without a cover to attach it to", () => {
    render(<Harness />)
    expect(screen.queryByLabelText("details.imageAlt")).toBeNull()
  })

  it("stages the cover's alt text into the form", () => {
    render(
      <Harness defaults={{ image_url: "https://cdn.example.com/cover.jpg" }} />,
    )
    const alt = screen.getByLabelText("details.imageAlt")
    fireEvent.change(alt, { target: { value: "Summer cover" } })

    expect(echo().alt).toBe("Summer cover")
    expect(echo().dirty).toMatchObject({ image_alt: true })
  })

  it("edits the Arabic title under the AR pill without touching the English", () => {
    render(
      <Harness withPill defaults={{ name: { en: "Summer", ar: "" } }} />,
    )
    expect(titleInput().dir).toBe("ltr")
    expect(titleInput().value).toBe("Summer")

    fireEvent.click(screen.getByRole("button", { name: "AR" }))

    expect(titleInput().dir).toBe("rtl")
    expect(titleInput().value).toBe("")
    expect(descriptionInput().dir).toBe("rtl")

    fireEvent.change(titleInput(), { target: { value: "صيف" } })

    expect(echo().name).toEqual({ en: "Summer", ar: "صيف" })
    expect(echo().dirty).toMatchObject({ name: { ar: true } })
    // Switching the pill is not an edit: only the typed locale is dirty.
    expect((echo().dirty.name as Record<string, unknown>).en).toBeUndefined()
  })

  it("shows the required-title error whichever locale is on screen", async () => {
    render(<Harness withPill defaults={{ name: { en: "", ar: "" } }} />)
    fireEvent.click(screen.getByRole("button", { name: "AR" }))
    fireEvent.click(screen.getByRole("button", { name: "validate" }))

    expect(await screen.findByText("validation.titleRequired")).toBeTruthy()
    expect(titleInput().getAttribute("aria-invalid")).toBe("true")
  })
})
