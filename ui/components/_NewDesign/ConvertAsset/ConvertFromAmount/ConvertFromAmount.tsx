import React, { useState } from "react"
import { setConvertAmount } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { Zone } from "quais"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import SharedLoadingSpinner from "../../../Shared/SharedLoadingSpinner"
import { isUtxoAccountTypeGuard } from "../../../../utils/accounts"

const ConvertFromAmount = () => {
  const dispatch = useBackgroundDispatch()

  const convertFromAccount = useBackgroundSelector(
    (state) => state.convertAssets.from
  )

  const amount = useBackgroundSelector((state) => state.convertAssets.amount)

  const [inputValue, setInputValue] = useState(amount)

  const tokenLabelHandle = () => {
    if (convertFromAccount && isUtxoAccountTypeGuard(convertFromAccount)) {
      return "QI"
    }

    return "QUAI"
  }

  const handleInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    const regex = /^[0-9]*\.?[0-9]*$/
    if (value === "" || regex.test(value)) {
      setInputValue(value)
      await dispatch(setConvertAmount(value))
    }
  }

  const onMaxAmount = async () => {
    if (
      convertFromAccount &&
      isUtxoAccountTypeGuard(convertFromAccount) &&
      convertFromAccount?.balances[Zone.Cyprus1]
    ) {
      const qiMaxamount = `${Number(
        convertFromAccount?.balances[Zone.Cyprus1]?.assetAmount?.amount
      )?.toFixed(4)}`

      setInputValue(qiMaxamount)
      await dispatch(setConvertAmount(qiMaxamount))
      return
    }

    if (
      convertFromAccount &&
      !isUtxoAccountTypeGuard(convertFromAccount) &&
      convertFromAccount?.localizedTotalMainCurrencyAmount
    ) {
      const quaiMaxAmount = convertFromAccount?.localizedTotalMainCurrencyAmount
      setInputValue(quaiMaxAmount)
      await dispatch(setConvertAmount(quaiMaxAmount))

      return
    }

    setInputValue("0.00")
  }

  const balanceHandle = () => {
    if (
      convertFromAccount &&
      isUtxoAccountTypeGuard(convertFromAccount) &&
      convertFromAccount?.balances[Zone.Cyprus1]
    ) {
      return `${Number(
        convertFromAccount?.balances[Zone.Cyprus1]?.assetAmount?.amount
      )?.toFixed(4)} ${convertFromAccount?.balances[
        Zone.Cyprus1
      ]?.assetAmount?.asset?.symbol?.toUpperCase()}`
    }

    if (
      convertFromAccount &&
      !isUtxoAccountTypeGuard(convertFromAccount) &&
      convertFromAccount?.balance
    ) {
      return convertFromAccount?.balance
    }

    return <SharedLoadingSpinner size="small" />
  }

  return (
    <>
      <div className="amount-wrapper">
        <div className="input-wrapper">
          <input
            type="text"
            className="amount-input"
            placeholder={`Enter ${tokenLabelHandle()} Amount`}
            value={inputValue}
            onChange={handleInput}
          />
          <button
            type="button"
            className="amount-button"
            onClick={() => onMaxAmount()}
          >
            Max
          </button>
        </div>

        <div className="amount-available">Available {balanceHandle()}</div>
      </div>

      <style jsx>{`
        .amount-wrapper {
          padding: 16px;
          background: var(--secondary-bg);
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .input-wrapper {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }

        .amount-input {
          margin-right: 16px;
          width: 100%;
          font-size: 20px;
          font-weight: 500;
          line-height: 30px;
          color: var(--primary-text);
        }

        .amount-input::placeholder {
          color: var(--secondary-text);
          font-size: 18px;
          font-weight: 500;
        }

        .amount-button {
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

export default ConvertFromAmount
