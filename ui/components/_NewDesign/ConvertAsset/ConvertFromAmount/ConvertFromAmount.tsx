import React, { useEffect, useState } from "react"
import {
  setConvertAmount,
  setConvertExpectedResultHandle,
} from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { formatQi, Zone } from "quais"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import SharedLoadingSpinner from "../../../Shared/SharedLoadingSpinner"
import { isAccountTotalTypeGuard, isUtxoAccountTypeGuard } from "../../../../utils/accounts"

// Reserve 0.01 QUAI for transaction fees
const TRANSACTION_FEE_RESERVE = 0.01

const ConvertFromAmount = () => {
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

    // Check if we're dealing with WQI
    if (convertFromAccount?.balance?.includes("WQI")) {
      return "WQI"
    }

    return "QUAI"
  }

  const handleInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    
    // Check if we're dealing with WQI unwrapping
    const isWQI = convertFromAccount && isAccountTotalTypeGuard(convertFromAccount) ? convertFromAccount?.balance?.includes("WQI") : false
    
    if (isWQI) {
      // For WQI, only allow whole numbers
      const wholeNumberRegex = /^[0-9]*$/
      if (value === "" || wholeNumberRegex.test(value)) {
        setInputValue(value)
        await dispatch(setConvertAmount(value))
      }
    } else {
      // For other tokens, allow decimals
      const regex = /^[0-9]*\.?[0-9]*$/
      if (value === "" || regex.test(value)) {
        setInputValue(value)
        await dispatch(setConvertAmount(value))
      }
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
      // Extract the numeric part from the balance string (e.g., "93.3690 QUAI" or "10.5 WQI")
      const balanceString = convertFromAccount.balance
      const parts = balanceString.split(" ")
      const numericPart = parts[0]
      const tokenSymbol = parts[1] || "QUAI"
      const numericAmount = parseFloat(numericPart)

      // For WQI, use full balance but floor to whole number (gas is paid in QUAI)
      if (tokenSymbol === "WQI") {
        if (!Number.isNaN(numericAmount) && numericAmount > 0) {
          const wholeAmount = Math.floor(numericAmount).toString()
          setInputValue(wholeAmount)
          await dispatch(setConvertAmount(wholeAmount))
          return
        }
      } else {
        // For QUAI, reserve for transaction fee
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
      const balanceString = convertFromAccount.balance
      const parts = balanceString.split(" ")
      const numericAmount = parseFloat(parts[0])
      const tokenSymbol = parts[1] || "QUAI"

      // For WQI, show only whole number portion available (gas is paid in QUAI)
      if (tokenSymbol === "WQI") {
        const wholeAmount = Math.floor(numericAmount)
        return `${wholeAmount} WQI`
      }

      // Show available balance minus transaction fee reserve for QUAI accounts
      if (
        !Number.isNaN(numericAmount) &&
        numericAmount > TRANSACTION_FEE_RESERVE
      ) {
        const availableAmount = (
          numericAmount - TRANSACTION_FEE_RESERVE
        ).toFixed(4)
        return `${availableAmount} ${tokenSymbol}`
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
