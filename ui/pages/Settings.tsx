import React, { ReactElement, useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "react-i18next"
import {
  setNewDefaultWalletValue,
  selectDefaultWallet,
  toggleHideBanners,
  selectHideBanners,
  selectShowPelagusNotifications,
  setNewPelagusNotificationsValue,
} from "@pelagus/pelagus-background/redux-slices/ui"
import { useHistory } from "react-router-dom"
import {
  FeatureFlags,
  isEnabled,
  wrapIfDisabled,
  wrapIfEnabled,
} from "@pelagus/pelagus-background/features"
import SharedSelect from "../components/Shared/SharedSelect"
import { getLanguageIndex, getAvalableLanguages } from "../_locales"
import { getLanguage, setLanguage } from "../_locales/i18n"
import SettingButton from "./Settings/SettingButton"
import SharedIcon from "../components/Shared/SharedIcon"
import SharedDrawer from "../components/Shared/SharedDrawer"
import SharedToggleButtonGA from "../components/Shared/SharedToggleButtonGA"

const NUMBER_OF_CLICKS_FOR_DEV_PANEL = 15
const FAQ_URL = "https://pelaguswallet.io"
const FOOTER_ACTIONS = [
  {
    icon: "icons/m/discord",
    linkTo: "https://discord.gg/pcaA5EapZk",
  },
  {
    icon: "twitter",
    linkTo: "https://twitter.com/PelagusWallet",
  },
  {
    icon: "icons/m/github",
    linkTo: "https://github.com/PelagusWallet/pelagus",
  },
]

function VersionLabel(): ReactElement {
  const { t } = useTranslation()
  const history = useHistory()
  const [clickCounter, setClickCounter] = useState(0)
  const [isHover, setIsHover] = useState(false)

  useEffect(() => {
    if (
      isEnabled(FeatureFlags.SWITCH_RUNTIME_FLAGS) &&
      clickCounter === NUMBER_OF_CLICKS_FOR_DEV_PANEL &&
      isHover
    ) {
      setIsHover(false)
      setClickCounter(0)
      history.push("/dev")
    }
  }, [clickCounter, history, isHover])

  return (
    <div className="version">
      <button
        type="button"
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
        onClick={() => setClickCounter((prevState) => prevState + 1)}
      >
        {t("settings.versionLabel", {
          version: process.env.VERSION ?? t("settings.unknownVersionOrCommit"),
        })}
        {process.env.COMMIT_SHA
          ? `<${process.env.COMMIT_SHA?.slice(0, 7)}>`
          : ``}
      </button>
      <style jsx>
        {`
          .version {
            color: var(--green-40);
            font-size: 14px;
            font-weight: 500;
            margin: 0 auto;
            padding-top: 10px;
          }
        `}
      </style>
    </div>
  )
}

function SettingRow(props: {
  title: string
  component: () => ReactElement
}): ReactElement {
  const { title, component } = props

  return (
    <li>
      <div className="left">{title}</div>
      <div className="right">{component()}</div>
      <style jsx>
        {`
          li {
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;

            color: var(--white);
            font-size: 16px;
            font-weight: 500;
            line-height: 20px;
          }
        `}
      </style>
    </li>
  )
}

export default function Settings(): ReactElement {
  const { t } = useTranslation()
  const history = useHistory()
  const dispatch = useDispatch()
  const hideBanners = useSelector(selectHideBanners)
  const defaultWallet = useSelector(selectDefaultWallet)
  const showPelagusNotifications = useSelector(selectShowPelagusNotifications)
  const toggleDefaultWallet = (defaultWalletValue: boolean) => {
    dispatch(setNewDefaultWalletValue(defaultWalletValue))
  }
  const toggleShowPelagusNotifications = (
    pelagusNotificationsValue: boolean
  ) => {
    dispatch(setNewPelagusNotificationsValue(pelagusNotificationsValue))
  }

  const toggleHideNotificationBanners = (toggleValue: boolean) => {
    dispatch(toggleHideBanners(!toggleValue))
  }

  const setAsDefault = {
    title: t("settings.setAsDefault"),
    component: () => (
      <SharedToggleButtonGA
        onChange={(toggleValue) => toggleDefaultWallet(toggleValue)}
        value={defaultWallet}
      />
    ),
  }

  const pelagusNotifications = {
    title: t("settings.showPelagusNotifications"),
    component: () => (
      <SharedToggleButtonGA
        onChange={(toggleValue) => toggleShowPelagusNotifications(toggleValue)}
        value={showPelagusNotifications}
      />
    ),
  }

  const langOptions = getAvalableLanguages()
  const langIdx = getLanguageIndex(getLanguage())
  const languages = {
    title: t("settings.language"),
    component: () => (
      <SharedSelect
        width={194}
        options={langOptions}
        onChange={setLanguage}
        defaultIndex={langIdx}
      />
    ),
  }

  const needHelp = {
    title: "",
    component: () => (
      <SettingButton
        label={t("settings.needHelp")}
        ariaLabel={t("settings.needHelp")}
        icon="new-tab"
        onClick={() => window.open(FAQ_URL, "_blank")?.focus()}
      />
    ),
  }

  const bugReport = {
    title: "",
    component: () => (
      <SettingButton
        link="/settings/export-logs"
        label={t("settings.bugReport")}
        ariaLabel={t("settings.exportLogs.ariaLabel")}
        icon="continue"
      />
    ),
  }

  const dAppsSettings = {
    title: "",
    component: () => (
      <SettingButton
        link="/settings/connected-websites"
        label={t("settings.connectedWebsites")}
        ariaLabel={t("settings.connectedWebsitesSettings.ariaLabel")}
        icon="continue"
      />
    ),
  }

  const qiCoinbaseAddress = {
    title: "",
    component: () => (
      <SettingButton
        link="/settings/qiCoinbaseAddress"
        label={t("settings.qiCoinbaseAddress")}
        ariaLabel={t("settings.qiCoinbaseAddressSettings.ariaLabel")}
        icon="continue"
      />
    ),
  }

  const addCustomAsset = {
    title: "",
    component: () => (
      <SettingButton
        link="/settings/add-custom-asset"
        label={t("settings.addCustomAsset")}
        ariaLabel={t("settings.connectedWebsitesSettings.ariaLabel")}
        icon="continue"
      />
    ),
  }

  const notificationBanner = {
    title: t("settings.showBanners"),
    component: () => (
      <SharedToggleButtonGA
        onChange={(toggleValue) => toggleHideNotificationBanners(toggleValue)}
        value={!hideBanners}
      />
    ),
  }

  const settings = Object.values({
    general: {
      title: t("settings.group.general"),
      items: [
        ...wrapIfDisabled(
          FeatureFlags.ENABLE_UPDATED_DAPP_CONNECTIONS,
          setAsDefault
        ),
        dAppsSettings,
        qiCoinbaseAddress,
        pelagusNotifications,
        ...wrapIfEnabled(FeatureFlags.SUPPORT_MULTIPLE_LANGUAGES, languages),
        ...wrapIfEnabled(
          FeatureFlags.SUPPORT_ACHIEVEMENTS_BANNER,
          notificationBanner
        ),
      ],
    },
    walletOptions: {
      title: t("settings.group.walletOptions"),
      items: [addCustomAsset],
    },
    helpCenter: {
      title: t("settings.group.helpCenter"),
      items: [bugReport, needHelp],
    },
  })

  return (
    <section className="standard_width_padded">
      <SharedDrawer
        title={t("settings.mainMenu")}
        isOpen
        close={() => history.push("/")}
        fillAvailable
        isScrollable
        footer={
          <div className="footer">
            <div className="action_icons">
              {FOOTER_ACTIONS.map(({ icon, linkTo }) => (
                <SharedIcon
                  key={icon}
                  icon={`${icon}.svg`}
                  width={18}
                  color="var(--white)"
                  hoverColor="var(--green-40)"
                  transitionHoverTime="0.2s"
                  onClick={() => {
                    window.open(linkTo, "_blank")?.focus()
                  }}
                />
              ))}
            </div>
            <VersionLabel />
          </div>
        }
      >
        <div className="menu">
          <ul>
            {settings.map(({ title, items }) => (
              <div className="group" key={title}>
                <span className="group_title">{title}</span>
                {items.map((item, index) => {
                  const key = `${title}-${item.title}-${index}`
                  return (
                    <SettingRow
                      key={key}
                      title={item.title}
                      component={item.component}
                    />
                  )
                })}
              </div>
            ))}
          </ul>
        </div>
      </SharedDrawer>

      <style jsx>
        {`
          section {
            display: flex;
            flex-flow: column;
            justify-content: space-between;
            height: 544px;
            background-color: var(--hunter-green);
          }

          .menu {
            display: flex;
            justify-content: space-between;
            flex-direction: column;
          }

          h1 {
            color: var(--white);
            font-size: 22px;
            font-weight: 500;
            line-height: 32px;
            margin-bottom: 28px;
          }

          span {
            color: var(--green-40);
            font-size: 16px;
            font-weight: 400;
            line-height: 24px;
          }

          .footer {
            width: 100vw;
            margin-left: -24px;
            text-align: center;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .action_icons {
            display: flex;
            justify-content: center;
            gap: 18px;
          }

          .group {
            border-bottom: 1px solid var(--white);
            margin-bottom: 20px;
            padding-bottom: 20px;
          }

          .group:last-child {
            border-bottom: none;
            padding: 0;
            margin: 0;
          }

          .group_title {
            color: var(--green-40);
            font-family: "Segment";
            font-style: normal;
            font-weight: 400;
            font-size: 12px;
            line-height: 18px;
          }
        `}
      </style>
    </section>
  )
}
