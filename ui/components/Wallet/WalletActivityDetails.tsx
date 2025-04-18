import React, { ReactElement, useEffect, useState } from "react"
import {
  selectCurrentAccount,
  selectCurrentNetwork,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import {
  Activity,
  ActivityDetail,
  fetchSelectedActivityDetails,
} from "@pelagus/pelagus-background/redux-slices/activities"
import { utxoActivityTimestampHandle } from "@pelagus/pelagus-background/redux-slices/utils/utxo-activities-utils"
import { selectAssetPricePoint } from "@pelagus/pelagus-background/redux-slices/assets"
import { QUAI } from "@pelagus/pelagus-background/constants"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import { getBlockExplorerURL } from "../../utils/networks"
import WalletActivityListItem from "./WalletActivityListItem"
import ArrowRightIcon from "../Shared/_newDeisgn/iconComponents/ArrowRightIcon"
import SharedLoadingSpinner from "../Shared/SharedLoadingSpinner"

interface WalletActivityDetailsProps {
  activityItem: Activity
  activityInitiatorAddress: string
}

export default function WalletActivityDetails(
  props: WalletActivityDetailsProps
): ReactElement {
  const dispatch = useBackgroundDispatch()
  const { activityItem, activityInitiatorAddress } = props

  const [details, setDetails] = useState<ActivityDetail[]>([])

  const network = useBackgroundSelector(selectCurrentNetwork)
  const account = useBackgroundSelector(selectCurrentAccount)
  const blockExplorerUrl = getBlockExplorerURL(network, account.address)
  const quaiUsdPricePoint = useBackgroundSelector((state) =>
    selectAssetPricePoint(state.assets, QUAI, "USD")
  )

  const { hash, blockTimestamp, from, to, nonce } = activityItem

  useEffect(() => {
    const fetchDetails = async () => {
      if (activityItem?.hash) {
        setDetails(
          (await dispatch(
            fetchSelectedActivityDetails(activityItem.hash)
          )) as unknown as ActivityDetail[]
        )
      }
    }
    fetchDetails()
  }, [activityItem.hash, dispatch])

  const loader = (
    <div style={{ padding: "3px 0" }}>
      <SharedLoadingSpinner size="small" variant="gray" />
    </div>
  )

  // Custom formatter to handle decimal places with proper trailing zero removal
  const formatDecimal = (
    value: number,
    minDecimals: number,
    maxDecimals: number
  ): string => {
    if (value === 0) return "0"

    // Format with maximum decimals
    const formatted = value.toFixed(maxDecimals)

    // Remove trailing zeros beyond minimum decimal places
    const regex = new RegExp(
      `\\.\\d{${minDecimals}}0+$|(\\.\\d{${minDecimals},})0+$`
    )
    return formatted.replace(regex, "$1")
  }

  // Extract Gas and Gas Price from details
  const gasDetail = details.find((detail) => detail.label === "Gas")
  const gasPriceDetail = details.find((detail) => detail.label === "Gas Price")

  // Parse gas and gasPrice values (remove formatting to get numeric values)
  let gasValue = 0
  let gasPriceValue = 0

  if (gasDetail?.value && typeof gasDetail.value === "string") {
    const gasMatch = gasDetail.value.match(/[\d,]+/)
    if (gasMatch) {
      gasValue = parseInt(gasMatch[0].replace(/,/g, ""), 10)
    }
  }

  if (gasPriceDetail?.value && typeof gasPriceDetail.value === "string") {
    const gasPriceMatch = gasPriceDetail.value.match(/([\d.]+)/)
    if (gasPriceMatch) {
      gasPriceValue = parseFloat(gasPriceMatch[1])
    }
  }

  // Calculate fee in QUAI and USD
  const feeInQuai = (gasValue * gasPriceValue) / 1e9 // Converting from Gwei to QUAI

  // Get QUAI to USD conversion rate
  let quaiUsdRate = 0
  if (quaiUsdPricePoint && quaiUsdPricePoint.amounts[1] > 0) {
    // The price point represents the USD value of 1 QUAI
    // amounts[0] is 1 QUAI in wei (10^18)
    // amounts[1] is the USD value with 5 decimal places (10^5)
    const usdAmount = Number(quaiUsdPricePoint.amounts[1]) / 100000 // Convert from 5 decimal places to USD
    quaiUsdRate = usdAmount // Direct rate as USD per QUAI
  }

  const feeInUsd = feeInQuai * quaiUsdRate

  // Format fee values with custom decimal rules
  const formattedFeeQuai = feeInQuai
    ? `${formatDecimal(feeInQuai, 2, 6)} QUAI`
    : loader

  const formattedFeeUsd = feeInUsd
    ? `$${formatDecimal(feeInUsd, 2, 5)}`
    : loader

  // Extract Amount from details
  const amount =
    details.find((detail) => detail.label === "Amount")?.value || loader

  return (
    <>
      <WalletActivityListItem
        isInModal
        key={hash}
        activity={activityItem}
        activityInitiatorAddress={activityInitiatorAddress}
      />
      <div className="activity-timestamp-block">
        <h5 className="activity-timestamp">
          {blockTimestamp && utxoActivityTimestampHandle(blockTimestamp)}
        </h5>
        <a
          href={`${blockExplorerUrl}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="activity-block-explorer"
        >
          View on block explorer
        </a>
      </div>
      <div className="wallets">
        <div className="wallet-sender">
          <h5 className="wallet-role">Sender</h5>
          <h4 className="wallet-payment-code">
            ({from.slice(0, 6)}...{from.slice(-4)})
          </h4>
        </div>
        <div className="arrow">
          <ArrowRightIcon />
        </div>
        <div className="wallet-receiver">
          <h5 className="wallet-role">Receiver</h5>
          <h4 className="wallet-payment-code">
            ({to?.slice(0, 6)}...
            {to?.slice(-4)})
          </h4>
        </div>
      </div>
      <div>
        <h4 className="activity-info-section">Transaction</h4>
        <div className="activity-info-wrapper">
          <h5 className="activity-info-title">Amount</h5>
          <h5 className="activity-info-value">{amount}</h5>
        </div>
        <div className="activity-info-wrapper">
          <h5 className="activity-info-title">Fee (USD)</h5>
          <h5 className="activity-info-value">{formattedFeeUsd}</h5>
        </div>
        <div className="activity-info-wrapper">
          <h5 className="activity-info-title">Fee (QUAI)</h5>
          <h5 className="activity-info-value">{formattedFeeQuai}</h5>
        </div>
        <div className="activity-info-wrapper">
          <h5 className="activity-info-title">Nonce</h5>
          <h5 className="activity-info-value">{nonce}</h5>
        </div>
        <div className="activity-info-wrapper">
          <h5 className="activity-info-title">Hash</h5>
          <h5 className="activity-info-value">
            {hash.slice(0, 16)}...{hash.slice(-4)}
          </h5>
        </div>
      </div>

      <style jsx>{`
        .activity-timestamp-block {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 500;
          font-size: 12px;
          line-height: 18px;
          margin-bottom: 24px;
        }

        .activity-timestamp {
          margin: 0;
          color: var(--secondary-text);
        }

        .activity-block-explorer {
          color: var(--accent-color);
        }

        .wallets {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .wallet-sender,
        .wallet-receiver {
          display: flex;
          flex-direction: column;
          align-content: center;
        }

        .wallet-sender {
          align-items: flex-start;
        }

        .wallet-receiver {
          align-items: flex-end;
        }

        .wallet-payment-code {
          margin: 0;
          font-weight: 500;
          font-size: 12px;
          line-height: 18px;
          color: var(--secondary-text);
        }

        .wallet-role {
          margin: 0;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--primary-text);
        }

        .arrow {
          padding: 15px 14px;
          border: 1px solid var(--secondary-text);
          border-radius: 50%;
        }

        .activity-info-section,
        .activity-info-value {
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          color: var(--primary-text);
          margin: 0 0 8px;
        }

        .activity-info-value {
          margin: 0;
        }

        .activity-info-wrapper {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .activity-info-title {
          font-size: 12px;
          font-weight: 500;
          line-height: 18px;
          color: var(--secondary-text);
          margin: 0;
        }
      `}</style>
    </>
  )
}
