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
  selectAutoLockInterval,
  setAutoLockInterval,
  selectQiWalletSyncInProgress,
  selectAggregateQiOutputsInProgress,
  selectAggregationProgress,
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
import SharedConfirmationModal from "../components/Shared/SharedConfirmationModal"
import CustomRPCModal from "../components/Settings/CustomRPCModal"
import { forceQiWalletFullRescan, aggregateQiOutputs, fetchUTXODenominationDistribution } from "@pelagus/pelagus-background/redux-slices/accounts"
import { useBackgroundDispatch, useBackgroundSelector } from "../hooks/redux-hooks"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { denominations } from "quais"

// Create dropdown options for denomination values
const denominationOptions = denominations.map((value, index) => {
  const qiValue = Number(value) / 1000 // Convert Qit to Qi
  return {
    value: index.toString(),
    label: qiValue.toString() + " Qi"
  }
})

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
  const backgroundDispatch = useBackgroundDispatch()
  const network = useBackgroundSelector(selectCurrentNetwork)
  const hideBanners = useSelector(selectHideBanners)
  const defaultWallet = useSelector(selectDefaultWallet)
  const showPelagusNotifications = useSelector(selectShowPelagusNotifications)
  const autoLockInterval = useSelector(selectAutoLockInterval)
  const [showRescanConfirm, setShowRescanConfirm] = useState(false)
  const [showAggregateConfirm, setShowAggregateConfirm] = useState(false)
  const [showCustomRPCModal, setShowCustomRPCModal] = useState(false)
  const [showUTXODistribution, setShowUTXODistribution] = useState(false)
  const [utxoDistributionData, setUtxoDistributionData] = useState<{ [denomination: number]: number } | null>(null)
  const [utxoDistributionLoading, setUtxoDistributionLoading] = useState(false)
  const [maxDenominationAggregate, setMaxDenominationAggregate] = useState(5)
  const [maxDenominationOutput, setMaxDenominationOutput] = useState(10)
  const [isOpenConfirmationModal, setIsOpenConfirmationModal] = useState(false)
  const [isTransactionError, setIsTransactionError] = useState(false)
  const [transactionHash, setTransactionHash] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const qiWalletSyncInProgress = useSelector(selectQiWalletSyncInProgress)
  const aggregateQiOutputsInProgress = useSelector(selectAggregateQiOutputsInProgress)
  const aggregationProgress = useSelector(selectAggregationProgress)

  useEffect(() => {
    if (!qiWalletSyncInProgress && !aggregateQiOutputsInProgress) {
      setShowRescanConfirm(false)
      setShowAggregateConfirm(false)
    }
  }, [qiWalletSyncInProgress, aggregateQiOutputsInProgress])

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

  const handleShowUTXODistribution = async () => {
    setUtxoDistributionLoading(true)
    setShowUTXODistribution(true)
    try {
      const result = await backgroundDispatch(fetchUTXODenominationDistribution())
      setUtxoDistributionData(result as unknown as { [denomination: number]: number })
    } catch (error) {
      console.error("Error fetching UTXO distribution:", error)
    } finally {
      setUtxoDistributionLoading(false)
    }
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
        label={t("settings.qiCoinbaseAddresses")}
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

  const customRPCUrl = {
    title: "",
    component: () => (
      <SettingButton
        label="Custom RPC URL"
        ariaLabel="Configure custom RPC URL"
        icon="continue"
        onClick={() => setShowCustomRPCModal(true)}
      />
    ),
  }

  const historicalConversionIntervals = {
    title: "",
    component: () => (
      <SettingButton
        label="Historical Conversion Intervals"
        ariaLabel="View historical conversion intervals"
        icon="continue"
        onClick={() => history.push("/intervals", { from: "settings" })}
      />
    ),
  }

  const forceQiWalletRescanDrawer = () => {
    return (
      <SharedDrawer
        title={t("settings.forceQiWalletRescan")}
        isOpen={showRescanConfirm}
        close={() => setShowRescanConfirm(false)}
        gap={0}
        customStyles={{
          top: "40%",
          transform: "translateY(-20%)"
        }}
      >
        <div className="confirm_rescan">
          <p>{t("settings.forceQiWalletRescanConfirm")}</p>
          <div className="button_container">
            <button
              type="button"
              className="cancel"
              onClick={() => setShowRescanConfirm(false)}
              disabled={qiWalletSyncInProgress}
            >
              {t("settings.cancel")}
            </button>
            <button
              type="button"
              className="confirm"
              onClick={async () => {
                try {
                  dispatch(forceQiWalletFullRescan())
                } catch (error) {
                  console.error("Error during Qi wallet rescan:", error)
                } finally {
                  setShowRescanConfirm(false)
                }
              }}
              disabled={qiWalletSyncInProgress}
            >
              {qiWalletSyncInProgress ? t("settings.rescanning") : t("settings.confirm")}
            </button>
          </div>
        </div>
        <style jsx>
          {`
            .confirm_rescan {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              justify-content: flex-start;
              height: 100%;
              width: 100%;
              gap: 24px;
            }
            p {
              color: var(--white);
              font-size: 14px;
              line-height: 24px;
              margin: 0;
              text-align: left;
            }
            .button_container {
              display: flex;
              justify-content: center;
              gap: 16px;
              width: 100%;
              margin-top: auto;
            }
            button {
              padding: 8px 24px;
              border-radius: 4px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
            }
            button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
            .cancel {
              background: transparent;
              border: 1px solid var(--green-40);
              color: var(--green-40);
            }
            .cancel:hover:not(:disabled) {
              background: var(--green-120);
            }
            .confirm {
              background: var(--green-40);
              border: none;
              color: var(--hunter-green);
            }
            .confirm:hover:not(:disabled) {
              background: var(--green-20);
            }
          `}
        </style>
      </SharedDrawer>
    )
  }

  const forceQiWalletRescan = {
    title: "",
    component: () => {
      return (
        <>
          <SettingButton
            label={t("settings.forceQiWalletRescan")}
            ariaLabel={t("settings.forceQiWalletRescan")}
            icon="continue"
            onClick={() => setShowRescanConfirm(true)}
            isLoading={qiWalletSyncInProgress}
          />
        </>
      )
    },
  }

  const aggregateQiOutputsDrawer = () => {
      return (
        <SharedDrawer
            title={t("settings.aggregateQiOutputs")}
            isOpen={showAggregateConfirm}
            close={() => setShowAggregateConfirm(false)}
            gap={0}
            customStyles={{
              overflow: "visible",
              zIndex: "1050",
              minHeight: "400px"
            }}
          >
            <div className="confirm_aggregate">
              <p className="confirm_aggregate_text">{t("settings.aggregateQiOutputsConfirm")}</p>
              {aggregateQiOutputsInProgress && (
                <div className="progress_container">
                  <div className="progress_bar">
                    <div 
                      className="progress_fill" 
                      style={{ width: `${aggregationProgress.progress}%` }}
                    />
                  </div>
                  <div className="progress_text">
                    <div className="progress_step">{aggregationProgress.step}</div>
                    {aggregationProgress.detail && (
                      <div className="progress_detail">{aggregationProgress.detail}</div>
                    )}
                    <div className="progress_percentage">{aggregationProgress.progress}%</div>
                  </div>
                </div>
              )}
              {!aggregateQiOutputsInProgress && (
                <>
                  <div className="input_container input_container_first">
                    <label htmlFor="maxDenominationAggregate">Max Denomination Input:</label>
                    <SharedSelect
                      width={120}
                      variant="small"
                      options={denominationOptions.slice(0, 14)} // 0-13 for input
                      onChange={(value) => setMaxDenominationAggregate(parseInt(value))}
                      defaultIndex={maxDenominationAggregate}
                      placement="bottom"
                    />
                  </div>
                  <div className="input_container input_container_second">
                    <label htmlFor="maxDenominationOutput">Max Denomination Output:</label>
                    <SharedSelect
                      width={120}
                      variant="small"
                      options={denominationOptions} // 0-14 for output
                      onChange={(value) => setMaxDenominationOutput(parseInt(value))}
                      defaultIndex={maxDenominationOutput}
                      placement="bottom"
                    />
                  </div>
                </>
              )}
              <div className="button_container">
                <button
                  type="button"
                  className="cancel"
                  onClick={() => setShowAggregateConfirm(false)}
                  disabled={aggregateQiOutputsInProgress}
                >
                  {t("settings.cancel")}
                </button>
                <button
                  type="button"
                  className="confirm"
                  onClick={async () => {
                    try {
                      const result = await backgroundDispatch(aggregateQiOutputs({ maxDenominationAggregate, maxDenominationOutput })) as any
                      if (result?.txHash) {
                        setTransactionHash(result.txHash)
                        setIsTransactionError(false)
                      } else {
                        if (result?.error) {
                          setErrorMessage(result.error.message)
                        } else {
                          setErrorMessage("Failed to aggregate Qi outputs")
                        }
                        setIsTransactionError(true)
                      }
                    } catch (error: any) {
                      console.error("Error during Qi aggregation:", error)
                      setErrorMessage(error?.message || "Failed to aggregate Qi outputs")
                      setIsTransactionError(true)
                    } finally {
                      setShowAggregateConfirm(false)
                      setIsOpenConfirmationModal(true)
                    }
                  }}
                  disabled={aggregateQiOutputsInProgress || qiWalletSyncInProgress}
                >
                  {aggregateQiOutputsInProgress ? t("settings.aggregating") : t("settings.confirm")}
                </button>
              </div>
            </div>
            <style jsx>
              {`
                .confirm_aggregate {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 320px;
                  height: 100%;
                  width: 100%;
                  gap: 24px;
                  overflow: visible;
                }
                .confirm_aggregate_text {
                  color: var(--white);
                  font-size: 12px;
                  line-height: 24px;
                  margin: 0 0 12px 0;
                }
                .input_container {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 12px;
                  margin: 0 0 8px 0;
                }
                .input_container label {
                  color: var(--white);
                  font-size: 14px;
                  margin-bottom: 0;
                  min-width: 140px;
                  text-align: right;
                }
                .input_container_first {
                  z-index: 1002;
                  position: relative;
                }
                .input_container_second {
                  z-index: 1001;
                  position: relative;
                }
                .button_container {
                  display: flex;
                  justify-content: center;
                  gap: 16px;
                  margin-top: 16px;
                  width: 100%;
                }
                button {
                  padding: 8px 24px;
                  border-radius: 4px;
                  font-size: 14px;
                  font-weight: 500;
                  cursor: pointer;
                  transition: all 0.2s;
                }
                button:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                }
                .cancel {
                  background: transparent;
                  border: 1px solid var(--green-40);
                  color: var(--green-40);
                }
                .cancel:hover:not(:disabled) {
                  background: var(--green-120);
                }
                .confirm {
                  background: var(--green-40);
                  border: none;
                  color: var(--hunter-green);
                }
                .confirm:hover:not(:disabled) {
                  background: var(--green-20);
                }
                .progress_container {
                  display: flex;
                  flex-direction: column;
                  gap: 12px;
                  width: 100%;
                  margin: 20px 0;
                }
                .progress_bar {
                  width: 100%;
                  height: 8px;
                  background: var(--hunter-green);
                  border-radius: 4px;
                  overflow: hidden;
                  border: 1px solid var(--green-40);
                }
                .progress_fill {
                  height: 100%;
                  background: linear-gradient(90deg, var(--green-40) 0%, var(--green-20) 100%);
                  transition: width 0.3s ease;
                  border-radius: 3px;
                }
                .progress_text {
                  display: flex;
                  flex-direction: column;
                  gap: 4px;
                  text-align: center;
                }
                .progress_step {
                  color: var(--white);
                  font-size: 14px;
                  font-weight: 500;
                }
                .progress_detail {
                  color: var(--green-40);
                  font-size: 12px;
                  font-weight: 400;
                }
                .progress_percentage {
                  color: var(--green-20);
                  font-size: 16px;
                  font-weight: 600;
                }
              `}
            </style>
          </SharedDrawer>
      )
  }

  const utxoDistributionDrawer = () => {
    return (
      <SharedDrawer
        title="Qi UTXO Distribution"
        isOpen={showUTXODistribution}
        close={() => setShowUTXODistribution(false)}
        gap={0}
      >
        <div className="utxo_distribution">
          {utxoDistributionLoading ? (
            <div className="loading">Loading UTXO distribution...</div>
          ) : utxoDistributionData ? (
            <div className="chart_container">
              <div className="chart_title">UTXO Count by Denomination</div>
              <div className="chart">
                {Object.entries(utxoDistributionData)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([denomination, count]) => {
                    const maxCount = Math.max(...Object.values(utxoDistributionData))
                    const barHeight = maxCount > 0 ? (count / maxCount) * 200 : 0
                    const denominationIndex = Number(denomination)
                    const qiValue = denominationIndex < denominations.length ? Number(denominations[denominationIndex]) / 1000 : Number(denomination)
                    return (
                      <div key={denomination} className="bar_container">
                        <div className="bar_label">{count}</div>
                        <div 
                          className="bar" 
                          style={{ height: `${barHeight}px` }}
                        />
                        <div className="denomination_label">{qiValue}</div>
                      </div>
                    )
                  })}
              </div>
            </div>
          ) : (
            <div className="error">Failed to load UTXO distribution data</div>
          )}
        </div>
        <style jsx>
          {`
            .utxo_distribution {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              height: 100%;
              width: 100%;
              padding: 20px;
              box-sizing: border-box;
              text-align: center;
              gap: 24px;
              overflow: hidden;
            }
            .loading, .error {
              color: var(--white);
              font-size: 16px;
              text-align: center;
              margin: auto;
            }
            .chart_container {
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 16px;
            }
            .chart_title {
              color: var(--white);
              font-size: 18px;
              font-weight: 500;
              margin-bottom: 20px;
              text-align: center;
            }
            .chart {
              display: flex;
              align-items: flex-end;
              justify-content: flex-start;
              gap: 8px;
              height: 250px;
              width: 100%;
              overflow-x: auto;
              padding: 0 10px;
              margin: 0 auto;
            }
            .bar_container {
              display: flex;
              flex-direction: column;
              align-items: center;
              min-width: 30px;
            }
            .bar {
              background: var(--green-40);
              width: 24px;
              min-height: 2px;
              border-radius: 2px 2px 0 0;
              transition: background-color 0.2s;
            }
            .bar:hover {
              background: var(--green-20);
            }
            .bar_label {
              color: var(--white);
              font-size: 10px;
              margin-bottom: 4px;
              min-height: 12px;
            }
            .denomination_label {
              color: var(--green-40);
              font-size: 10px;
              margin-top: 4px;
              text-align: center;
            }
          `}
        </style>
      </SharedDrawer>
    )
  }

  const aggregateQiOutputsButton = {
    title: "",
    component: () => {
      return (
        <>
          <SettingButton
            label={t("settings.aggregateQiOutputs")}
            ariaLabel={t("settings.aggregateQiOutputs")}
            icon="continue"
            onClick={() => setShowAggregateConfirm(true)}
            isLoading={aggregateQiOutputsInProgress || qiWalletSyncInProgress}
          />
        </>
      )
    },
  }

  const showQiUTXODistributionButton = {
    title: "",
    component: () => {
      return (
        <>
          <SettingButton
            label="Show Qi UTXO Distribution"
            ariaLabel="Show Qi UTXO Distribution"
            icon="continue"
            onClick={handleShowUTXODistribution}
            isLoading={utxoDistributionLoading}
          />
        </>
      )
    },
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

  const autoLockSetting = {
    title: t("settings.autoLockInterval"),
    component: () => (
      <SharedSelect
        width={194}
        options={[
          { value: "5", label: "5 minutes" },
          { value: "10", label: "10 minutes" },
          { value: "15", label: "15 minutes" },
          { value: "30", label: "30 minutes" },
          { value: "60", label: "1 hour" },
        ]}
        onChange={(value) => dispatch(setAutoLockInterval(Number(value)))}
        defaultIndex={(() => {
          const interval = autoLockInterval || 10
          const index = [5, 10, 15, 30, 60].indexOf(interval)
          return index >= 0 ? index : 1 // Default to 10 minutes if value not found
        })()}
      />
    ),
  }

  const confirmationModalProps = isTransactionError
    ? {
        headerTitle: "Aggregation Failed",
        subtitle: errorMessage || "Failed to aggregate Qi outputs",
        title: "Transaction Error!",
        icon: {
          src: "icons/s/notif-wrong.svg",
          height: "43",
          width: "43",
          color: "var(--error-color)",
          padding: "32px",
        },
        isOpen: isOpenConfirmationModal,
        onClose: () => setIsOpenConfirmationModal(false),
      }
    : {
        headerTitle: "Aggregation Successful",
        title: "Transaction Sent",
        link: {
          text: "View Transaction",
          url: `${network.blockExplorerURL}/tx/${transactionHash}`,
        },
        isOpen: isOpenConfirmationModal,
        onClose: () => setIsOpenConfirmationModal(false),
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
        autoLockSetting,
        ...wrapIfEnabled(FeatureFlags.SUPPORT_MULTIPLE_LANGUAGES, languages),
        ...wrapIfEnabled(
          FeatureFlags.SUPPORT_ACHIEVEMENTS_BANNER,
          notificationBanner
        ),
      ],
    },
    walletOptions: {
      title: t("settings.group.walletOptions"),
      items: [customRPCUrl, addCustomAsset, forceQiWalletRescan, aggregateQiOutputsButton, showQiUTXODistributionButton, historicalConversionIntervals],
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
        {showRescanConfirm && forceQiWalletRescanDrawer()}
        {showAggregateConfirm && aggregateQiOutputsDrawer()}
        {showUTXODistribution && utxoDistributionDrawer()}
        
        <CustomRPCModal
          isOpen={showCustomRPCModal}
          onClose={() => setShowCustomRPCModal(false)}
        />
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

      <SharedConfirmationModal
        headerTitle={confirmationModalProps.headerTitle}
        title={confirmationModalProps.title}
        subtitle={confirmationModalProps.subtitle}
        isOpen={confirmationModalProps.isOpen}
        onClose={confirmationModalProps.onClose}
        icon={confirmationModalProps.icon}
        link={confirmationModalProps.link}
      />

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
