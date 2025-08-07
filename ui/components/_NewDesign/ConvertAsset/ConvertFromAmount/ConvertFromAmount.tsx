import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  setConvertAmount,
  setConvertExpectedResultHandle,
} from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { formatQi, Zone } from "quais"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import SharedLoadingSpinner from "../../../Shared/SharedLoadingSpinner"
import { isUtxoAccountTypeGuard } from "@pelagus/pelagus-ui/utils/accounts"

// Reserve 0.01 QUAI for transaction fees
const TRANSACTION_FEE_RESERVE = 0.01

const ConvertFromAmount = () => {
  const { t } = useTranslation()
  const dispatch = useBackgroundDispatch()

  const convertFromAccount = useBackgroundSelector(
    (state) => state.convertAssets.from
  )

  const amount = useBackgroundSelector((state) => state.convertAssets.amount)

  const [inputValue, setInputValue] = useState(amount)

  useEffect(() => {
    dispatch(setConvertExpectedResultHandle())
  }, [amount, dispatch])

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
      convertFromAccount?.balances[Zone.Cyprus1] &&
      convertFromAccount?.balances[Zone.Cyprus1]?.assetAmount?.amount
    ) {
      const qiMaxAmount = Number(
        formatQi(
          convertFromAccount?.balances[Zone.Cyprus1]?.assetAmount?.amount
        )
      )

      // Ensure we have a valid number
      if (!Number.isNaN(qiMaxAmount) && qiMaxAmount > 0) {
        const formattedAmount = qiMaxAmount.toFixed(3)
        setInputValue(formattedAmount)
        await dispatch(setConvertAmount(formattedAmount))
        return
      }
    }

    if (
      convertFromAccount &&
      !isUtxoAccountTypeGuard(convertFromAccount) &&
      convertFromAccount?.balance
    ) {
      // Extract the numeric part from the balance string (e.g., "93.3690 QUAI")
      const balanceString = convertFromAccount.balance
      const numericPart = balanceString.split(" ")[0] // Get the first part before the space
      const numericAmount = parseFloat(numericPart)

      // Ensure we have a valid number and reserve for transaction fee
      if (
        !Number.isNaN(numericAmount) &&
        numericAmount > TRANSACTION_FEE_RESERVE
      ) {
        const adjustedAmount = (
          numericAmount - TRANSACTION_FEE_RESERVE
        ).toFixed(4)
        setInputValue(adjustedAmount)
        await dispatch(setConvertAmount(adjustedAmount))
        return
      }
    }

    // Default fallback if no valid balance is found
    setInputValue("0.00")
    await dispatch(setConvertAmount("0.00"))
  }

  const balanceHandle = () => {
    if (
      convertFromAccount &&
      isUtxoAccountTypeGuard(convertFromAccount) &&
      convertFromAccount?.balances[Zone.Cyprus1]
    ) {
      return `${Number(
        formatQi(
          convertFromAccount?.balances[Zone.Cyprus1]?.assetAmount?.amount
        )
      )?.toFixed(4)} ${convertFromAccount?.balances[
        Zone.Cyprus1
      ]?.assetAmount?.asset?.symbol?.toUpperCase()}`
    }

    if (
      convertFromAccount &&
      !isUtxoAccountTypeGuard(convertFromAccount) &&
      convertFromAccount?.balance
    ) {
      // Show available balance minus transaction fee reserve for QUAI accounts
      const balanceString = convertFromAccount.balance
      const parts = balanceString.split(" ")
      const numericAmount = parseFloat(parts[0])

      if (
        !Number.isNaN(numericAmount) &&
        numericAmount > TRANSACTION_FEE_RESERVE
      ) {
        const availableAmount = (
          numericAmount - TRANSACTION_FEE_RESERVE
        ).toFixed(4)
        return `${availableAmount} ${parts[1] || "QUAI"}`
      }

      return convertFromAccount.balance
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
            placeholder={t("convert_amount.enter_quai_amount")}
            value={inputValue}
            onChange={handleInput}
          />
          <button
            type="button"
            className="amount-button"
            onClick={() => onMaxAmount()}
          >
            {t("convert_amount.max")}
          </button>
        </div>

        <div className="amount-available">{t("convert_amount.available")} {balanceHandle()}</div>
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
