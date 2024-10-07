import React, { useState } from "react"
import { setQiSendAmount } from "@pelagus/pelagus-background/redux-slices/qiSend"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"

const Amount = () => {
  const dispatch = useBackgroundDispatch()

  const amount = useBackgroundSelector((state) => state.qiSend.amount)

  const [inputValue, setInputValue] = useState(amount)

  const handleInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    const regex = /^[0-9]*\.?[0-9]*$/
    if (value === "" || regex.test(value)) {
      setInputValue(value)
      await dispatch(setQiSendAmount(value))
    }
  }

  const onMaxAmount = () => {
    // setInputValue("20.01244")
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
          <button type="button" className="amount-button" onClick={onMaxAmount}>
            Max
          </button>
        </div>
        <p className="amount-available">Available - QI</p>
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
