import { FeatureFlags, isEnabled } from "@pelagus/pelagus-background/features"
import { I18nKey } from "../_locales/i18n"

export type TabInfo = {
  /**
   * i18n key with the title for this tab
   */
  title: I18nKey
  path: string
  icon: string
}

const allTabs: (TabInfo & { visible?: boolean })[] = [
  {
    path: "/wallet",
    title: "tabs.wallet",
    icon: "wallet",
  },
  {
    path: "/settings",
    title: "tabs.settings",
    icon: "settings",
  },
]

const tabs = allTabs
  .map(({ visible = true, ...tab }) => (visible ? tab : null))
  .filter((tab): tab is TabInfo => tab !== null)

export const defaultTab = tabs[0]

export default tabs
