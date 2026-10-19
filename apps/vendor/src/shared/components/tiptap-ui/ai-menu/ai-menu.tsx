"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import { BubbleMenu } from "@tiptap/react/menus"
import type { Editor } from "@tiptap/react"
import type { EditorState } from "@tiptap/pm/state"
import { useCurrentEditor } from "@tiptap/react"
import { LoaderCircle, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Button as UiButton } from "@repo/ui/components/button"
import { Textarea as UiTextarea } from "@repo/ui/components/textarea"
import {
  AI_ACTIONS,
  type AiAction,
  aiErrorDescription,
  runAiEditorAction,
} from "@/shared/lib/editor-ai"

export interface AiMenuState {
  isOpen: boolean
  tone?: string
  language: string
  shouldShowInput: boolean
  inputIsFocused: boolean
  fallbackAnchor: {
    element: HTMLElement | null
    rect: DOMRect | null
  }
}

interface AiMenuStateContextValue {
  state: AiMenuState
  updateState: (updates: Partial<AiMenuState>) => void
  setFallbackAnchor: (element: HTMLElement | null, rect?: DOMRect | null) => void
  reset: () => void
}

const initialState: AiMenuState = {
  isOpen: false,
  language: "en",
  shouldShowInput: false,
  inputIsFocused: false,
  fallbackAnchor: {
    element: null,
    rect: null,
  },
}

const AiMenuStateContext = createContext<AiMenuStateContextValue | null>(null)

export function AiMenuStateProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, setState] = useState<AiMenuState>(initialState)

  const updateState = useCallback((updates: Partial<AiMenuState>) => {
    setState((current) => ({ ...current, ...updates }))
  }, [])

  const setFallbackAnchor = useCallback(
    (element: HTMLElement | null, rect?: DOMRect | null) => {
      setState((current) => ({
        ...current,
        fallbackAnchor: {
          element,
          rect: rect ?? null,
        },
      }))
    },
    [],
  )

  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  const value = useMemo(
    () => ({ state, updateState, setFallbackAnchor, reset }),
    [reset, setFallbackAnchor, state, updateState],
  )

  return (
    <AiMenuStateContext.Provider value={value}>
      {children}
    </AiMenuStateContext.Provider>
  )
}

export function useAiMenuState() {
  const context = useContext(AiMenuStateContext)
  if (!context) {
    throw new Error("useAiMenuState must be used within AiMenuStateProvider")
  }
  return context
}

function AiMenuPanel({
  editor,
  loading,
  selectionOnly,
}: {
  editor: Editor
  loading: boolean
  selectionOnly?: boolean
}) {
  const t = useTranslations("editor.ai")
  const { state, updateState } = useAiMenuState()

  const prompt = state.shouldShowInput ? state.tone ?? "" : ""

  const setPrompt = (value: string) => {
    updateState({
      shouldShowInput: true,
      tone: value,
    })
  }

  const handleAction = async (action: AiAction) => {
    try {
      await runAiEditorAction({
        action,
        editor,
        prompt: action === "custom" ? prompt : undefined,
      })
      if (action === "custom") {
        updateState({
          tone: "",
          shouldShowInput: false,
          isOpen: false,
        })
      }
      sileo.success({ title: t("applied") })
    } catch (error) {
      sileo.error({
        title: t("failed"),
        description: aiErrorDescription(error, t),
      })
    }
  }

  return (
    <div className="flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg">
      <div className="flex items-center gap-2 px-1 pt-1 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5" />
        {selectionOnly ? t("selectionTitle") : t("documentTitle")}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {AI_ACTIONS.map((action) => (
          <UiButton
            key={action.id}
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => handleAction(action.id)}
            className="justify-start"
          >
            {t(`actions.${action.id}`)}
          </UiButton>
        ))}
      </div>

      <UiTextarea
        rows={3}
        value={prompt}
        disabled={loading}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={
          selectionOnly
            ? t("selectionPlaceholder")
            : t("documentPlaceholder")
        }
      />

      <UiButton
        type="button"
        disabled={loading || !prompt.trim()}
        onClick={() => handleAction("custom")}
      >
        {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {loading ? t("working") : t("runCustomPrompt")}
      </UiButton>
    </div>
  )
}

export function AiMenuContent({
  editor: providedEditor,
  anchorToSelection = false,
}: {
  editor?: Editor | null
  anchorToSelection?: boolean
}) {
  const { editor: contextEditor } = useCurrentEditor()
  const editor = providedEditor ?? contextEditor
  const { state } = useAiMenuState()

  const storage = editor?.storage as
    | { uiState?: { aiGeneration?: { isLoading?: boolean } } }
    | undefined
  const aiLoading = !!storage?.uiState?.aiGeneration?.isLoading

  if (!editor) return null

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({
        editor: currentEditor,
        state: editorState,
      }: {
        editor: Editor
        state: EditorState
      }) =>
        currentEditor.isEditable &&
        (!editorState.selection.empty || (anchorToSelection && state.isOpen))
      }
      options={{ placement: "top", offset: 10 }}
      className="z-50"
    >
      <AiMenuPanel
        editor={editor}
        loading={aiLoading}
        selectionOnly={anchorToSelection}
      />
    </BubbleMenu>
  )
}

export function AiMenu({
  editor,
  anchorToSelection = false,
}: {
  editor?: Editor | null
  anchorToSelection?: boolean
}) {
  return <AiMenuContent editor={editor} anchorToSelection={anchorToSelection} />
}

export function useAiContentTracker() {
  return null
}

export function useTextSelectionTracker() {
  return null
}

export function getContextAndInsertAt(editor: Editor | null) {
  if (!editor) {
    return { context: "", insertAt: null, isSelection: false }
  }

  const { from, to, empty } = editor.state.selection
  return {
    context: editor.getHTML(),
    insertAt: { from, to },
    isSelection: !empty,
  }
}

export function findPrioritizedAIElement(editor: Editor | null) {
  return editor?.view.dom ?? null
}

export function getSelectionRangeRect(editor: Editor | null) {
  if (!editor || editor.state.selection.empty) return null

  const { from, to } = editor.state.selection
  const start = editor.view.coordsAtPos(from)
  const end = editor.view.coordsAtPos(to)

  return new DOMRect(
    start.left,
    Math.min(start.top, end.top),
    Math.max(1, end.right - start.left),
    Math.max(start.bottom, end.bottom) - Math.min(start.top, end.top),
  )
}

export function getEditorContentRect(editorDom: HTMLElement) {
  const rect = editorDom.getBoundingClientRect()
  return { left: rect.left, width: rect.width }
}

export function createEditorWidthAnchorRect(
  editorDom: HTMLElement,
  sourceRect: DOMRect,
) {
  const { left, width } = getEditorContentRect(editorDom)
  return new DOMRect(left, sourceRect.top, width, sourceRect.height)
}

export function createVirtualAnchor(
  rect: DOMRect,
  referenceElement?: HTMLElement,
) {
  return {
    nodeType: 1 as const,
    getBoundingClientRect() {
      if (!referenceElement) return rect
      const referenceRect = referenceElement.getBoundingClientRect()
      return new DOMRect(
        referenceRect.left,
        rect.top,
        rect.width,
        rect.height,
      )
    },
  } as HTMLElement
}
