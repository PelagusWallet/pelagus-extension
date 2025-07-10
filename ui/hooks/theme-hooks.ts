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