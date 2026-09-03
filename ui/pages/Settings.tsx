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
  selectTheme,
  updateTheme,
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
import { deepRescanQiWallet, aggregateQiOutputs, fetchUTXODenominationDistribution } from "@pelagus/pelagus-background/redux-slices/accounts"
import { useBackgroundDispatch, useBackgroundSelector } from "../hooks/redux-hooks"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { denominations } from "quais"
import { DEFAULT_AUTO_LOCK_INTERVAL_MINUTES } from "@pelagus/pelagus-background/constants/auto-lock"

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
const AUTO_LOCK_INTERVAL_OPTIONS = [
  { value: "5", label: "5 minutes" },
  { value: "10", label: "10 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "1440", label: "1 day" },
  { value: "4320", label: "3 days" },
  { value: "10080", label: "1 week" },
]
const FOOTER_ACTIONS = [
  {
    label: "Discord",
    icon: "icons/m/discord",
    linkTo: "https://discord.gg/pcaA5EapZk",
  },
  {
    label: "X",
    icon: "twitter",
    linkTo: "https://twitter.com/PelagusWallet",
  },
  {
    label: "GitHub",
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
            color: var(--secondary-text);
            font-size: 14px;
            font-weight: 500;
            margin: 0 auto;
          }

          .version button {
            color: inherit;
            font: inherit;
            line-height: 20px;
            padding: 0;
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
  const isActionRow = title.length === 0

  return (
    <li className={isActionRow ? "action_row" : undefined}>
      {!isActionRow && <div className="left">{title}</div>}
      <div className="right">{component()}</div>
      <style jsx>
        {`
          li {
            box-sizing: border-box;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            min-height: 52px;
            padding: 4px 0;

            color: var(--primary-text);
            font-size: 16px;
            font-weight: 500;
            line-height: 20px;
          }

          .left {
            flex: 1 1 auto;
            min-width: 0;
          }

          .right {
            flex: 0 0 auto;
          }

          .action_row .right {
            flex: 1 1 100%;
            min-width: 0;
            width: 100%;
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
  const [showDeepRescanConfirm, setShowDeepRescanConfirm] = useState(false)
  const [deepRescanExtraAddresses, setDeepRescanExtraAddresses] = useState("50")
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
  const currentTheme = useSelector(selectTheme)

  useEffect(() => {
    if (!qiWalletSyncInProgress && !aggregateQiOutputsInProgress) {
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
        ariaLabel={t("settings.language")}
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


  const deepRescanButton = {
    title: "",
    component: () => {
      return (
        <SettingButton
          label="Deep Rescan (Recovery)"
          ariaLabel="Deep Rescan Recovery"
          icon="continue"
          onClick={() => setShowDeepRescanConfirm(true)}
          isLoading={qiWalletSyncInProgress}
        />
      )
    },
  }

  const deepRescanDrawer = () => {
    return (
      <>
        <div className="modal_overlay" onClick={() => setShowDeepRescanConfirm(false)} />
        <div className="modal_container settings-modal">
          <SharedDrawer
            title="Deep Rescan (Recovery)"
            isOpen={showDeepRescanConfirm}
            close={() => setShowDeepRescanConfirm(false)}
            gap={0}
            customStyles={{
              overflow: "visible",
              minHeight: "200px",
              maxWidth: "450px",
              width: "80%",
              margin: "0 auto",
              position: "relative"
            }}
          >
            <div className="confirm_rescan">
              <p className="confirm_rescan_text">
                Scans extra addresses beyond the normal limit for all wallets and payment channels to recover any missed UTXOs. This may take several minutes.
              </p>
              <div className="deep_rescan_input">
                <label htmlFor="extraAddresses">Extra addresses to scan:</label>
                <input
                  id="extraAddresses"
                  type="number"
                  min={1}
                  max={500}
                  value={deepRescanExtraAddresses}
                  onChange={(e) => setDeepRescanExtraAddresses(e.target.value)}
                  onBlur={() => {
                    const num = parseInt(deepRescanExtraAddresses) || 1
                    setDeepRescanExtraAddresses(String(Math.max(1, Math.min(500, num))))
                  }}
                  disabled={qiWalletSyncInProgress}
                />
              </div>
              <div className="rescan_buttons">
                <button
                  className="btn_cancel"
                  onClick={() => setShowDeepRescanConfirm(false)}
                  disabled={qiWalletSyncInProgress}
                >
                  Cancel
                </button>
                <button
                  className="btn_confirm"
                  onClick={async () => {
                    const parsed = parseInt(deepRescanExtraAddresses) || 50
                    const clamped = Math.max(1, Math.min(500, parsed))
                    await backgroundDispatch(deepRescanQiWallet(clamped))
                    setShowDeepRescanConfirm(false)
                  }}
                  disabled={qiWalletSyncInProgress}
                >
                  {qiWalletSyncInProgress ? "Scanning..." : "Confirm"}
                </button>
              </div>
            </div>
            <style jsx>{`
              .confirm_rescan {
                display: flex;
                flex-direction: column;
                gap: 16px;
                padding: 16px;
              }
              .confirm_rescan_text {
                font-size: 14px;
                line-height: 1.5;
                color: var(--primary-text);
                margin: 0;
              }
              .deep_rescan_input {
                display: flex;
                align-items: center;
                gap: 12px;
              }
              .deep_rescan_input label {
                font-size: 14px;
                color: var(--primary-text);
                white-space: nowrap;
              }
              .deep_rescan_input input {
                width: 80px;
                padding: 6px 10px;
                border-radius: 8px;
                border: 1px solid var(--primary-text);
                background: transparent;
                color: var(--primary-text);
                font-size: 14px;
              }
              .rescan_buttons {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
              }
              .btn_cancel,
              .btn_confirm {
                padding: 8px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
              }
              .btn_cancel {
                background: transparent;
                color: var(--primary-text);
                border: 1px solid var(--primary-text);
              }
              .btn_cancel:hover:not(:disabled) {
                background: var(--primary-text);
                color: var(--primary-bg);
              }
              .btn_confirm {
                background: var(--primary-text);
                color: var(--primary-bg);
                border: none;
              }
              .btn_confirm:hover:not(:disabled) {
                background: var(--secondary-text);
              }
              .btn_cancel:disabled,
              .btn_confirm:disabled {
                opacity: 0.5;
                cursor: not-allowed;
              }
            `}</style>
          </SharedDrawer>
        </div>
      </>
    )
  }

  const aggregateQiOutputsDrawer = () => {
      return (
        <>
          <div className="modal_overlay" onClick={() => setShowAggregateConfirm(false)} />
          <div className="modal_container settings-modal">
            <SharedDrawer
                title={t("settings.aggregateQiOutputs")}
                isOpen={showAggregateConfirm}
                close={() => setShowAggregateConfirm(false)}
                gap={0}
                customStyles={{
                  overflow: "visible",
                  minHeight: "400px",
                  maxWidth: "450px",
                  width: "80%",
                  margin: "0 auto",
                  position: "relative"
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
                      placement="top"
                      ariaLabel="Maximum input denomination"
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
                      placement="top"
                      ariaLabel="Maximum output denomination"
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
                  color: var(--primary-text);
                  font-size: 14px;
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
                  color: var(--primary-text);
                  font-size: 14px;
                  margin-bottom: 0;
                  min-width: 140px;
                  text-align: right;
                }
                /* Ensure dropdown lists are fully scrollable and on top */
                .input_container .options.show {
                  max-height: 200px !important;
                  overflow-y: auto !important;
                  z-index: 10000 !important;
                }
                .input_container_first {
                  z-index: 1001;
                  position: relative;
                }
                .input_container_second {
                  z-index: 1003;
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
                  border: 1px solid var(--border-dark);
                  color: var(--secondary-text);
                }
                .cancel:hover:not(:disabled) {
                  background: var(--secondary-bg);
                }
                .confirm {
                  background: var(--accent-color);
                  border: none;
                  color: var(--contrast-text);
                }
                .confirm:hover:not(:disabled) {
                  filter: brightness(1.1);
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
                  background: var(--secondary-bg);
                  border-radius: 4px;
                  overflow: hidden;
                  border: 1px solid var(--border-dark);
                }
                .progress_fill {
                  height: 100%;
                  background: var(--accent-color);
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
                  color: var(--primary-text);
                  font-size: 14px;
                  font-weight: 500;
                }
                .progress_detail {
                  color: var(--secondary-text);
                  font-size: 12px;
                  font-weight: 400;
                }
                .progress_percentage {
                  color: var(--primary-text);
                  font-size: 16px;
                  font-weight: 600;
                }
              `}
            </style>
          </SharedDrawer>
          </div>
        </>
      )
  }

  const utxoDistributionDrawer = () => {
    return (
      <>
        <div className="modal_overlay" onClick={() => setShowUTXODistribution(false)} />
        <div className="modal_container settings-modal">
          <SharedDrawer
            title="Qi UTXO Distribution"
            isOpen={showUTXODistribution}
            close={() => setShowUTXODistribution(false)}
            gap={0}
            customStyles={{
              overflow: "visible",
              minHeight: "400px",
              maxWidth: "405px",
              width: "72%",
              margin: "0 auto",
              position: "relative"
            }}
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
              color: var(--primary-text);
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
              color: var(--primary-text);
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
              background: var(--accent-color);
              width: 24px;
              min-height: 2px;
              border-radius: 2px 2px 0 0;
              transition: background-color 0.2s;
            }
            .bar:hover {
              filter: brightness(1.1);
            }
            .bar_label {
              color: var(--primary-text);
              font-size: 10px;
              margin-bottom: 4px;
              min-height: 12px;
            }
            .denomination_label {
              color: var(--secondary-text);
              font-size: 10px;
              margin-top: 4px;
              text-align: center;
            }
          `}
        </style>
      </SharedDrawer>
      </div>
    </>
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
        options={AUTO_LOCK_INTERVAL_OPTIONS}
        onChange={(value) => dispatch(setAutoLockInterval(Number(value)))}
        ariaLabel={t("settings.autoLockInterval")}
        placement="top"
        defaultIndex={(() => {
          const interval =
            autoLockInterval || DEFAULT_AUTO_LOCK_INTERVAL_MINUTES
          const index = AUTO_LOCK_INTERVAL_OPTIONS.findIndex(
            ({ value }) => Number(value) === interval
          )
          return index >= 0
            ? index
            : AUTO_LOCK_INTERVAL_OPTIONS.findIndex(
                ({ value }) =>
                  Number(value) === DEFAULT_AUTO_LOCK_INTERVAL_MINUTES
              )
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
  const themeSetting = {
    title: t("settings.theme"),
    component: () => (
      <SharedSelect
        width={194}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        onChange={(value) => dispatch(updateTheme(value))}
        defaultIndex={currentTheme === "dark" ? 1 : 0}
        ariaLabel={t("settings.theme")}
        placement="top"
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
        autoLockSetting,
        themeSetting,
        ...wrapIfEnabled(FeatureFlags.SUPPORT_MULTIPLE_LANGUAGES, languages),
        ...wrapIfEnabled(
          FeatureFlags.SUPPORT_ACHIEVEMENTS_BANNER,
          notificationBanner
        ),
      ],
    },
    walletOptions: {
      title: t("settings.group.walletOptions"),
      items: [customRPCUrl, addCustomAsset, deepRescanButton, aggregateQiOutputsButton, showQiUTXODistributionButton, historicalConversionIntervals],
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
      >
        <div className="menu">
          <ul className="settings_groups">
            {settings.map(({ title, items }) => (
              <li className="group" key={title}>
                <span className="group_title">{title}</span>
                <ul className="setting_rows">
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
                </ul>
              </li>
            ))}
          </ul>
          <footer className="footer" aria-label="Pelagus community links">
            <div className="action_icons">
              {FOOTER_ACTIONS.map(({ label, icon, linkTo }) => (
                <a
                  key={icon}
                  className="social_link"
                  href={linkTo}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                >
                  <SharedIcon
                    icon={`${icon}.svg`}
                    width={18}
                    color="var(--primary-text)"
                    transitionHoverTime="0.2s"
                  />
                </a>
              ))}
            </div>
            <VersionLabel />
          </footer>
        </div>
      </SharedDrawer>

      {showDeepRescanConfirm && deepRescanDrawer()}
      {showAggregateConfirm && aggregateQiOutputsDrawer()}
      {showUTXODistribution && utxoDistributionDrawer()}
      
      {showCustomRPCModal && (
        <>
          <div className="modal_overlay" onClick={() => setShowCustomRPCModal(false)} />
          <div className="modal_container settings-modal">
            <CustomRPCModal
              isOpen={showCustomRPCModal}
              onClose={() => setShowCustomRPCModal(false)}
            />
          </div>
        </>
      )}

      <SharedConfirmationModal
        headerTitle={confirmationModalProps.headerTitle}
        title={confirmationModalProps.title}
        subtitle={confirmationModalProps.subtitle}
        isOpen={confirmationModalProps.isOpen}
        onClose={confirmationModalProps.onClose}
        icon={confirmationModalProps.icon}
        link={confirmationModalProps.link}
      />

      <style jsx global>
        {`
          .modal_overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 9998;
            animation: fadeIn 0.2s ease-in-out;
          }

          .modal_container {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: slideIn 0.3s ease-out;
            min-width: 360px;
          }

          /* Remove background and padding from drawer wrapper for Settings modals */
          .settings-modal .drawer-wrapper {
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }

          /* Hide the drawer's own overlay for Settings modals */
          .settings-modal .drawer-overlay {
            display: none !important;
          }

          /* Add proper styling to the inner content */
          .settings-modal .drawer-header-wrapper,
          .settings-modal .drawer-body {
            background: var(--primary-bg);
            border-radius: 16px;
          }

          .settings-modal .drawer-header-wrapper {
            padding: 24px 24px 0 24px;
            border-radius: 16px 16px 0 0;
          }

          .settings-modal .drawer-body {
            padding: 0 24px 24px 24px;
            border-radius: 0 0 16px 16px;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translate(-50%, -45%);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%);
            }
          }
        `}
      </style>
      <style jsx>
        {`
          section {
            display: flex;
            flex-flow: column;
            justify-content: space-between;
            height: 544px;
            background-color: var(--primary-bg);
          }

          .menu {
            display: flex;
            justify-content: space-between;
            flex-direction: column;
          }

          .settings_groups,
          .setting_rows {
            display: block;
            width: 100%;
          }

          h1 {
            color: var(--primary-text);
            font-size: 22px;
            font-weight: 500;
            line-height: 32px;
            margin-bottom: 28px;
          }

          span {
            color: var(--secondary-text);
            font-size: 16px;
            font-weight: 400;
            line-height: 24px;
          }

          .footer {
            width: 100%;
            text-align: center;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            margin-top: 8px;
            padding: 24px 0 8px;
            border-top: 1px solid var(--secondary-bg);
          }

          .action_icons {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }

          .social_link {
            box-sizing: border-box;
            display: grid;
            place-items: center;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            transition: background-color 160ms ease-out,
              transform 160ms ease-out;
          }

          .social_link:hover {
            background-color: var(--secondary-bg);
          }

          .social_link:focus-visible {
            outline: 2px solid var(--green-60);
            outline-offset: 2px;
          }

          .social_link:active {
            transform: scale(0.96);
          }

          @media (prefers-reduced-motion: reduce) {
            .social_link {
              transition: none;
            }
          }

          .group {
            display: block;
            border-bottom: 1px solid var(--secondary-bg);
            margin-bottom: 16px;
            padding-bottom: 16px;
          }

          .group:last-child {
            border-bottom: none;
            padding: 0;
            margin: 0;
          }

          .group_title {
            color: var(--secondary-text);
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
