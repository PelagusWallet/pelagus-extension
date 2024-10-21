import React from "react"
import ArrowRightIcon from "../../../Shared/_newDeisgn/iconComponents/ArrowRightIcon"
import { useBackgroundSelector } from "../../../../hooks"
import { isUtxoAccountTypeGuard } from "../../../../utils/accounts"
import { UtxoAccountData } from "@pelagus/pelagus-background/redux-slices/accounts"
import { AccountTotal } from "@pelagus/pelagus-background/redux-slices/selectors"

const ConfirmConversionDestination = () => {
  const convertFromAccount = useBackgroundSelector(
    (state) => state.convertAssets.from
  )
  const convertToAccount = useBackgroundSelector(
    (state) => state.convertAssets.to
  )

  const accountInfoHandle = (
    account: UtxoAccountData | AccountTotal | null
  ) => {
    if (!account) {
      return { address: "", name: "" }
    }
    if (isUtxoAccountTypeGuard(account)) {
      const { paymentCode, defaultName } = account
      return {
        address: `(${paymentCode.slice(0, 6)}...${paymentCode.slice(-4)})`,
        name: `${defaultName} - QI`,
      }
    }

    const { shortenedAddress, shortName } = account

    return { address: `(${shortenedAddress})`, name: `${shortName} - QUAI` }
  }

  return (
    <>
      <div className="wallets">
        <div className="wallet-from">
          <h5 className="wallet-role">From</h5>
          <h4 className="wallet-name">
            {accountInfoHandle(convertFromAccount).name}
          </h4>
          <h4 className="wallet-address">
            {accountInfoHandle(convertFromAccount).address}
          </h4>
        </div>
        <div className="arrow">
          <ArrowRightIcon />
        </div>
        <div className="wallet-to">
          <h5 className="wallet-role">To</h5>
          <h4 className="wallet-name">
            {accountInfoHandle(convertToAccount).name}
          </h4>
          <h4 className="wallet-address">
            {accountInfoHandle(convertToAccount).address}
          </h4>
        </div>
      </div>
      <style jsx>
        {`
          .wallets {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 24px;
            margin-bottom: 24px;
          }

          .wallet-from,
          .wallet-to {
            display: flex;
            flex-direction: column;
            align-content: center;
            align-items: center;
          }

          .wallet-address,
          .wallet-role {
            margin: 0;
            font-weight: 500;
            font-size: 12px;
            color: var(--secondary-text);
          }

          .wallet-role {
            line-height: 18px;
            margin-bottom: 4px;
          }

          .wallet-name {
            margin: 0;
            font-weight: 500;
            font-size: 14px;
            color: var(--primary-text);
          }

          .arrow {
            padding: 15px 14px;
            border: 1px solid var(--secondary-text);
            border-radius: 50%;
          }
        `}
      </style>
    </>
  )
}

export default ConfirmConversionDestination
