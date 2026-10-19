"use client"

import { useState } from "react"
import type { Editor } from "@tiptap/react"
import { useCurrentEditor } from "@tiptap/react"
import { LoaderCircle, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Button } from "@/shared/components/tiptap-ui-primitive/button"
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover"
import { Button as UiButton } from "@repo/ui/components/button"
import { Textarea as UiTextarea } from "@repo/ui/components/textarea"
import { aiErrorDescription, runAiEditorAction } from "@/shared/lib/editor-ai"
import { useAiMenuState } from "@/shared/components/tiptap-ui/ai-menu"

export function AiAskButton({
  editor: providedEditor,
}: {
  editor?: Editor | null
}) {
  const t = useTranslations("editor.ai")
  const { editor: contextEditor } = useCurrentEditor()
  const editor = providedEditor ?? contextEditor
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const { updateState } = useAiMenuState()

  if (!editor) return null

  const handleSubmit = async () => {
    if (!prompt.trim()) return

    setLoading(true)
    try {
      updateState({ isOpen: true, shouldShowInput: true, inputIsFocused: true })
      await runAiEditorAction({
        action: "custom",
        editor,
        prompt,
      })
      setPrompt("")
      updateState({ isOpen: false, shouldShowInput: false, inputIsFocused: false })
      sileo.success({ title: t("applied") })
    } catch (error) {
      sileo.error({
        title: t("failed"),
        description: aiErrorDescription(error, t),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" tooltip={t("ask")}>
            {loading ? (
              <LoaderCircle className="tiptap-button-icon animate-spin" />
            ) : (
              <Sparkles className="tiptap-button-icon" />
            )}
            {t("ask")}
          </Button>
        }
      />
      <PopoverContent className="w-[min(24rem,calc(100vw-2rem))]">
        <div className="flex flex-col gap-2">
          <UiTextarea
            rows={4}
            value={prompt}
            disabled={loading}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={t("askPlaceholder")}
          />
          <UiButton type="button" disabled={loading || !prompt.trim()} onClick={handleSubmit}>
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {loading ? t("working") : t("runPrompt")}
          </UiButton>
        </div>
      </PopoverContent>
    </Popover>
  )
}
