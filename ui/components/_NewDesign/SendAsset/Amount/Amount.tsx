import React, { useState } from "react"
import { setQiSendAmount } from "@pelagus/pelagus-background/redux-slices/qiSend"
import { UtxoAccountData } from "@pelagus/pelagus-background/redux-slices/accounts"
import { Zone } from "quais"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import SharedLoadingSpinner from "../../../Shared/SharedLoadingSpinner"

const Amount = () => {
  const dispatch = useBackgroundDispatch()

  const amount = useBackgroundSelector((state) => state.qiSend.amount)

  const [inputValue, setInputValue] = useState(amount)

  const currentNetwork = useBackgroundSelector(selectCurrentNetwork)
  const utxoAccountsByPaymentCode = useBackgroundSelector(
    (state) => state.account.accountsData.utxo[currentNetwork.chainID]
  )

  const utxoAccountArr = Object.values(utxoAccountsByPaymentCode)

  const handleInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    const regex = /^[0-9]*\.?[0-9]*$/
    if (value === "" || regex.test(value)) {
      setInputValue(value)
      await dispatch(setQiSendAmount(value))
    }
  }

  const onMaxAmount = (utxoAccount: UtxoAccountData | null) => {
    if (!utxoAccount?.balances[Zone.Cyprus1]) {
      setInputValue("0")
      return
    }

    setInputValue(
      `${Number(
        utxoAccount?.balances[Zone.Cyprus1]?.assetAmount?.amount
      )?.toFixed(4)}`
    )
  }

  const balanceHandle = (utxoAccount: UtxoAccountData | null) => {
    if (!utxoAccount?.balances[Zone.Cyprus1]) {
      return <SharedLoadingSpinner size="small" />
    }

    return `${Number(
      utxoAccount?.balances[Zone.Cyprus1]?.assetAmount?.amount
    )?.toFixed(4)} ${utxoAccount?.balances[
      Zone.Cyprus1
    ]?.assetAmount?.asset?.symbol?.toUpperCase()}`
  }

  return (
    <>
      <section className="amount-wallet">
        <h3 className="amount-label">Amount</h3>
        <div className="amount-wrapper">
          <input
            type="text"
            className="amount-input"
            placeholder="Enter Amount"
            value={inputValue}
            onChange={handleInput}
          />
          <button
            type="button"
            className="amount-button"
            onClick={() => onMaxAmount(utxoAccountArr[0])}
          >
            Max
          </button>
        </div>
        <div className="amount-available">
          Available - {balanceHandle(utxoAccountArr[0])}
        </div>
      </section>
      <style jsx>{`
        .amount-wallet {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 24px;
        }

        .amount-label {
          margin: 0;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--secondary-text);
        }

        .amount-wrapper {
          position: relative;
        }

        .amount-input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 69px 12px 16px;
          border: 2px solid var(--tertiary-bg);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          color: var(--primary-text);
        }

        .amount-input:focus {
          background: var(--secondary-bg);
          border-color: var(--accent-color);
        }

        .amount-input:hover {
          border-color: var(--accent-color);
        }

        .amount-input::placeholder {
          color: var(--secondary-text);
        }

        .amount-button {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          padding: 8px 12px;
          font-weight: 700;
          font-size: 12px;
          line-height: 10px;
          color: var(--primary-text);
          background: var(--tertiary-bg);
          border-radius: 176px;
        }

        .amount-available {
          display: flex;
          align-content: center;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--secondary-text);
          text-align: end;
          margin: 0;
        }
      `}</style>
    </>
  )
}

export default Amount
