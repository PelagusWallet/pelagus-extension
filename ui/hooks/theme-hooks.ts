import { useEffect } from "react"
import { useSelector } from "react-redux"
import { selectTheme } from "@pelagus/pelagus-background/redux-slices/ui"

export const useTheme = (): void => {
  const theme = useSelector(selectTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark")
    } else {
      root.removeAttribute("data-theme")
    }
  }, [theme])
}

// Temporarily force dark theme for the current view without changing user preference.
// Restores the previous theme attribute on unmount.
export const useScopedDarkTheme = (): void => {
  useEffect(() => {
    const root = document.documentElement
    const prev = root.getAttribute("data-theme")
    root.setAttribute("data-theme", "dark")
    return () => {
      if (prev) {
        root.setAttribute("data-theme", prev)
      } else {
        root.removeAttribute("data-theme")
      }
    }
  }, [])
}
