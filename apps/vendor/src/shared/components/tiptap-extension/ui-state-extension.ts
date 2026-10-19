import { Extension } from "@tiptap/core"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    uiState: {
      aiGenerationSetIsLoading: (loading: boolean) => ReturnType
      aiGenerationHasMessage: (hasMessage: boolean) => ReturnType
    }
  }
}

export const UiState = Extension.create({
  name: "uiState",

  addStorage() {
    return {
      aiGeneration: {
        isLoading: false,
        hasMessage: false,
      },
    }
  },

  addCommands() {
    return {
      aiGenerationSetIsLoading:
        (loading: boolean) =>
        () => {
          this.storage.aiGeneration.isLoading = loading
          return true
        },

      aiGenerationHasMessage:
        (hasMessage: boolean) =>
        () => {
          this.storage.aiGeneration.hasMessage = hasMessage
          return true
        },
    }
  },
})
