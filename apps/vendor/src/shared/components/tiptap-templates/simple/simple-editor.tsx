"use client"

import { useEffect, useRef, useState } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import { useTranslations } from "next-intl"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Selection } from "@tiptap/extensions"
import { Placeholder } from "@tiptap/extension-placeholder"

// --- UI Primitives ---
import { Button } from "@/shared/components/tiptap-ui-primitive/button"
import { Spacer } from "@/shared/components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/shared/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/shared/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/shared/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import "@/shared/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/shared/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/shared/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/shared/components/tiptap-node/list-node/list-node.scss"
import "@/shared/components/tiptap-node/image-node/image-node.scss"
import "@/shared/components/tiptap-node/heading-node/heading-node.scss"
import "@/shared/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/shared/components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "@/shared/components/tiptap-ui/image-upload-button"
import { ListDropdownMenu } from "@/shared/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/shared/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/shared/components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/shared/components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/shared/components/tiptap-ui/link-popover"
import { MarkButton } from "@/shared/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/shared/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/shared/components/tiptap-ui/undo-redo-button"

// --- Icons ---
import { ArrowLeftIcon } from "@/shared/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/shared/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/shared/components/tiptap-icons/link-icon"

// --- Hooks ---
import { useIsBreakpoint } from "@/shared/hooks/use-is-breakpoint"
import { useWindowSize } from "@/shared/hooks/use-window-size"
import { useCursorVisibility } from "@/shared/hooks/use-cursor-visibility"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/shared/lib/tiptap-utils"
import { classifyImageUploadError } from "@/shared/lib/image-upload-error"
import { sileo } from "sileo"

// --- Styles ---
import "@/shared/components/tiptap-templates/simple/simple-editor.scss"
import { AiAskButton } from "@/shared/components/tiptap-ui/ai-ask-button"
import { AiMenu, AiMenuStateProvider } from "@/shared/components/tiptap-ui/ai-menu"
import { UiState } from "@/shared/components/tiptap-extension/ui-state-extension"

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
  enableAiMenu,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
  enableAiMenu: boolean
}) => {
  const t = useTranslations("editor")
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu modal={false} levels={[1, 2, 3, 4]} />
        <ListDropdownMenu
          modal={false}
          types={["bulletList", "orderedList", "taskList"]}
        />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton text={t("imageUpload.add")} />
        {enableAiMenu ? <AiAskButton /> : null}
      </ToolbarGroup>

      <Spacer />
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link"
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
)

interface SimpleEditorProps {
  value: string
  onChange: (html: string) => void
  onBlur?: () => void
  placeholder?: string
  dir?: "ltr" | "rtl"
  invalid?: boolean
  enableAiMenu?: boolean
}

export function SimpleEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  dir = "ltr",
  invalid,
  enableAiMenu = false,
}: SimpleEditorProps) {
  const t = useTranslations("editor")
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  })
  const isMobile = useIsBreakpoint()
  const { height } = useWindowSize()
  const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link">(
    "main"
  )
  const toolbarRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": t("contentArea"),
        class: "simple-editor",
        dir,
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      UiState,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => {
          const classified = classifyImageUploadError(error.message)
          const tr = tRef.current
          const title =
            classified.id === "tooLarge"
              ? tr("imageUpload.errors.tooLarge", { size: classified.size })
              : classified.id === "tooMany"
                ? tr("imageUpload.errors.tooMany", { limit: classified.limit })
                : classified.id === "noFile"
                  ? tr("imageUpload.errors.noFile")
                  : classified.id === "cancelled"
                    ? tr("imageUpload.errors.cancelled")
                    : tr("imageUpload.errors.failed")
          sileo.error({ title })
        },
      }),
    ],
    content: value || "",
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    onBlur() {
      onBlur?.()
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
  }, [editor, value])

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  })

  useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main")
    }
  }, [isMobile, mobileView])

  return (
    <div className="simple-editor-wrapper" data-invalid={invalid ? "true" : undefined}>
      <EditorContext.Provider value={{ editor }}>
        <AiMenuStateProvider>
          {enableAiMenu ? <AiMenu editor={editor} anchorToSelection /> : null}

          <Toolbar
            ref={toolbarRef}
            style={{
              ...(isMobile
                ? {
                    bottom: `calc(100% - ${height - rect.y}px)`,
                  }
                : {}),
            }}
          >
            {mobileView === "main" ? (
              <MainToolbarContent
                onHighlighterClick={() => setMobileView("highlighter")}
                onLinkClick={() => setMobileView("link")}
                isMobile={isMobile}
                enableAiMenu={enableAiMenu}
              />
            ) : (
              <MobileToolbarContent
                type={mobileView === "highlighter" ? "highlighter" : "link"}
                onBack={() => setMobileView("main")}
              />
            )}
          </Toolbar>

          <EditorContent
            editor={editor}
            role="presentation"
            className="simple-editor-content"
          />
        </AiMenuStateProvider>
      </EditorContext.Provider>
    </div>
  )
}
