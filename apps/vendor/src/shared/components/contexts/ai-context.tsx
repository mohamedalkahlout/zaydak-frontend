"use client"

import { createContext, useContext, useMemo } from "react"

interface AiContextValue {
  aiToken: string | null
  appId: string | null
  isOfficialAiConfigured: boolean
}

const AiContext = createContext<AiContextValue>({
  aiToken: "local-route",
  appId: null,
  isOfficialAiConfigured: false,
})

export function AiProvider({
  children,
  aiToken = "local-route",
  appId = null,
}: {
  children: React.ReactNode
  aiToken?: string | null
  appId?: string | null
}) {
  const value = useMemo<AiContextValue>(
    () => ({
      aiToken,
      appId,
      isOfficialAiConfigured: false,
    }),
    [aiToken, appId],
  )

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>
}

export function useAi() {
  return useContext(AiContext)
}
