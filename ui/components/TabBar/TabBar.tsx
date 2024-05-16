import React, { ReactElement } from "react"

import { matchPath, useHistory, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import TabBarIconButton from "./TabBarIconButton"
import tabs, { defaultTab } from "../../utils/tabs"

// REFACTOR remove
export default function TabBar(): ReactElement {
  const location = useLocation()

  const history = useHistory()
  const { t } = useTranslation()

  const activeTab =
    tabs.find(({ path }) =>
      matchPath(location.pathname, { path, exact: false })
    ) ?? defaultTab

  return (
    <nav aria-label="Main">
      {tabs.map(({ path, title, icon }) => {
        return (
          <TabBarIconButton
            key={path}
            icon={icon}
            title={t(title)}
            onClick={() => history.push(path)}
            isActive={activeTab.path === path}
          />
        )
      })}
      <style jsx>
        {`
          nav {
            width: 100%;
            height: 56px;
            background-color: var(--hunter-green);
            display: flex;
            justify-content: space-around;
            box-sizing: border-box;
            align-items: center;
            flex-shrink: 0;
            box-shadow: 0 0 5px rgba(0, 20, 19, 0.5);
            z-index: 10;
          }
        `}
      </style>
    </nav>
  )
}
