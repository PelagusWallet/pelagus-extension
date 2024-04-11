import React, { ReactElement, useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "react-i18next"
import {
  setNewDefaultWalletValue,
  selectDefaultWallet,
  selectHideDust,
  toggleHideDust,
  selectShowTestNetworks,
  toggleTestNetworks,
  toggleHideBanners,
  selectHideBanners,
  selectShowUnverifiedAssets,
  toggleShowUnverifiedAssets,
} from "@pelagus/pelagus-background/redux-slices/ui"
import { useHistory } from "react-router-dom"
import { selectMainCurrencySign } from "@pelagus/pelagus-background/redux-slices/selectors"
import {
  FeatureFlags,
  isEnabled,
  wrapIfDisabled,
  wrapIfEnabled,
} from "@pelagus/pelagus-background/features"
import SharedToggleButton from "../components/Shared/SharedToggleButton"
import SharedSelect from "../components/Shared/SharedSelect"
import { getLanguageIndex, getAvalableLanguages } from "../_locales"
import { getLanguage, setLanguage } from "../_locales/i18n"
import SettingButton from "./Settings/SettingButton"
import { useBackgroundSelector } from "../hooks"
import SharedIcon from "../components/Shared/SharedIcon"
import SharedTooltip from "../components/Shared/SharedTooltip"

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
        {process.env.COMMIT_SHA?.slice(0, 7) ??
          t("settings.unknownVersionOrCommit")}
      </button>
      <style jsx>
        {`
          .version {
            margin: 16px 0;
            color: var(--green-40);
            font-size: 16px;
            font-weight: 500;
            margin: 0 auto;
            padding: 16px 0px;
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
            padding-top: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;

            color: var(--green-20);
            font-size: 18px;
            font-weight: 600;
            line-height: 24px;
          }
        `}
      </style>
    </li>
  )
}

export default function Settings(): ReactElement {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const hideDust = useSelector(selectHideDust)
  const hideBanners = useSelector(selectHideBanners)
  const defaultWallet = useSelector(selectDefaultWallet)
  const showTestNetworks = useSelector(selectShowTestNetworks)
  const showUnverifiedAssets = useSelector(selectShowUnverifiedAssets)
  const mainCurrencySign = useBackgroundSelector(selectMainCurrencySign)

  const toggleHideDustAssets = (toggleValue: boolean) => {
    dispatch(toggleHideDust(toggleValue))
  }
  const toggleDefaultWallet = (defaultWalletValue: boolean) => {
    dispatch(setNewDefaultWalletValue(defaultWalletValue))
  }

  const toggleShowTestNetworks = (defaultWalletValue: boolean) => {
    dispatch(toggleTestNetworks(defaultWalletValue))
  }

  const toggleShowUnverified = (toggleValue: boolean) => {
    dispatch(toggleShowUnverifiedAssets(toggleValue))
  }

  const toggleHideNotificationBanners = (toggleValue: boolean) => {
    dispatch(toggleHideBanners(!toggleValue))
  }

  const hideSmallAssetBalance = {
    title: t("settings.hideSmallAssetBalance", {
      amount: 2,
      sign: mainCurrencySign,
    }),
    component: () => (
      <SharedToggleButton
        onChange={(toggleValue) => toggleHideDustAssets(toggleValue)}
        value={hideDust}
      />
    ),
  }

  const unverifiedAssets = {
    title: "",
    component: () => (
      <div className="content">
        <div className="left">
          {t("settings.showUnverifiedAssets")}
          <SharedTooltip width={190} customStyles={{ marginLeft: "4" }}>
            <div className="tooltip">
              <span>{t("settings.unverifiedAssets.tooltip.firstPart")}</span>
              {isEnabled(FeatureFlags.SUPPORT_UNVERIFIED_ASSET) && (
                <span>{t("settings.unverifiedAssets.tooltip.secondPart")}</span>
              )}
            </div>
          </SharedTooltip>
        </div>
        <SharedToggleButton
          onChange={(toggleValue) => toggleShowUnverified(toggleValue)}
          value={showUnverifiedAssets}
        />
        <style jsx>
          {`
            .content {
              display: flex;
              justify-content: space-between;
              width: 336px;
            }
            .left {
              display: flex;
              align-items: center;
            }
            .tooltip {
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
          `}
        </style>
      </div>
    ),
  }

  const setAsDefault = {
    title: t("settings.setAsDefault"),
    component: () => (
      <SharedToggleButton
        onChange={(toggleValue) => toggleDefaultWallet(toggleValue)}
        value={defaultWallet}
      />
    ),
  }

  const enableTestNetworks = {
    title: t("settings.enableTestNetworks"),
    component: () => (
      <SharedToggleButton
        onChange={(toggleValue) => toggleShowTestNetworks(toggleValue)}
        value={showTestNetworks}
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

  // FIXME temporary solution to hide analytics screen
  // const analytics = {
  //   title: "",
  //   component: () => (
  //     <SettingButton
  //       link="/settings/analytics"
  //       label={t("settings.analytics")}
  //       ariaLabel={t("settings.analyticsSetUp.ariaLabel")}
  //       icon="continue"
  //     />
  //   ),
  // }

  const notificationBanner = {
    title: t("settings.showBanners"),
    component: () => (
      <SharedToggleButton
        onChange={(toggleValue) => toggleHideNotificationBanners(toggleValue)}
        value={!hideBanners}
      />
    ),
  }

  // FIXME currently allows users to add networks that can break the extension
  // const customNetworks = {
  //   title: "",
  //   component: () => (
  //     <SettingButton
  //       link="/settings/custom-networks"
  //       label={t("settings.customNetworks")}
  //       ariaLabel={t("settings.customNetworksSettings.ariaLabel")}
  //       icon="continue"
  //     />
  //   ),
  // }

  const settings = Object.values({
    general: {
      title: t("settings.group.general"),
      items: [
        // setAsDefault is removed from settings in the new dApp Connections flow.
        ...wrapIfDisabled(
          FeatureFlags.ENABLE_UPDATED_DAPP_CONNECTIONS,
          setAsDefault
        ),
        dAppsSettings,
        // FIXME temporary solution to hide analytics screen
        // analytics,
        ...wrapIfEnabled(FeatureFlags.SUPPORT_MULTIPLE_LANGUAGES, languages),
        ...wrapIfEnabled(
          FeatureFlags.SUPPORT_ACHIEVEMENTS_BANNER,
          notificationBanner
        ),
      ],
    },
    walletOptions: {
      title: t("settings.group.walletOptions"),
      items: [
        hideSmallAssetBalance,
        unverifiedAssets,
        // customNetworks, // FIXME currently allows users to add networks that can break the extension //
        addCustomAsset,
        enableTestNetworks,
      ],
    },
    helpCenter: {
      title: t("settings.group.helpCenter"),
      items: [bugReport, needHelp],
    },
  })

  return (
    <section className="standard_width_padded">
      <div className="menu">
        <h1>{t("settings.mainMenu")}</h1>
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
      <div className="footer">
        <div className="action_icons">
          {FOOTER_ACTIONS.map(({ icon, linkTo }) => (
            <SharedIcon
              key={icon}
              icon={`${icon}.svg`}
              width={18}
              color="var(--green-20)"
              hoverColor="var(--trophy-gold)"
              transitionHoverTime="0.2s"
              onClick={() => {
                window.open(linkTo, "_blank")?.focus()
              }}
            />
          ))}
        </div>
        <VersionLabel />
      </div>
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
            display: flex;
            flex-direction: column;
          }
          h1 {
            color: var(--green-20);
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
            margin-top: 20px;
            margin-left: -24px;
            background-color: var(--green-95);
            text-align: center;
            padding-top: 16px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .action_icons {
            display: flex;
            justify-content: center;
            gap: 24px;
          }
          .group {
            border-bottom: 1px solid var(--green-80);
            margin-bottom: 24px;
            padding-bottom: 24px;
          }
          .group:last-child {
            border-bottom: none;
            padding: 0px;
            margin: 0px;
          }
          .group_title {
            color: var(--green-40);
            font-family: "Segment";
            font-style: normal;
            font-weight: 400;
            font-size: 16px;
            line-height: 24px;
          }
        `}
      </style>
    </section>
  )
}
