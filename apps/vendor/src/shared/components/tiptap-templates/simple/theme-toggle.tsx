"use client"

// --- UI Primitives ---
import { Button } from "@/shared/components/tiptap-ui-primitive/button"

// --- Icons ---
import { MoonStarIcon } from "@/shared/components/tiptap-icons/moon-star-icon"
import { SunIcon } from "@/shared/components/tiptap-icons/sun-icon"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

export function ThemeToggle() {
  const t = useTranslations("editor.themeToggle")
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => setIsDarkMode(mediaQuery.matches)
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    const initialDarkMode =
      !!document.querySelector('meta[name="color-scheme"][content="dark"]') ||
      window.matchMedia("(prefers-color-scheme: dark)").matches
    setIsDarkMode(initialDarkMode)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode)
  }, [isDarkMode])

  const toggleDarkMode = () => setIsDarkMode((isDark) => !isDark)

  return (
    <Button
      onClick={toggleDarkMode}
      aria-label={isDarkMode ? t("toLight") : t("toDark")}
      variant="ghost"
    >
      {isDarkMode ? (
        <MoonStarIcon className="tiptap-button-icon" />
      ) : (
        <SunIcon className="tiptap-button-icon" />
      )}
    </Button>
  )
}
