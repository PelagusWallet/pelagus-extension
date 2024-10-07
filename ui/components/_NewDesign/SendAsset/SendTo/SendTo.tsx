import React, { useState } from "react"
import { setQiSendReceiverPaymentCode } from "@pelagus/pelagus-background/redux-slices/qiSend"
import QrCodeScannerIcon from "../../../Shared/_newDeisgn/iconComponents/QrCodeScannerIcon"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"

const SendTo = () => {
  const dispatch = useBackgroundDispatch()

  const sendTo = useBackgroundSelector(
    (state) => state.qiSend.receiverPaymentCode
  )

  const [inputValue, setInputValue] = useState(sendTo)

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    setInputValue(value)
    await dispatch(setQiSendReceiverPaymentCode(value))
  }
  return (
    <>
      <section className="to-wallet">
        <h3 className="to-label">Send To</h3>

        <div className="to-wrapper">
          <input
            type="text"
            className="to-input"
            placeholder="Enter payment code (TL9C...)"
            value={inputValue}
            onChange={handleChange}
          />
          <QrCodeScannerIcon
            style={{
              position: "absolute",
              right: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              cursor: "pointer",
            }}
          />
        </div>
      </section>
      <style jsx>{`
        .to-wallet {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
        }

        .to-label {
          margin: 0;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--secondary-text);
        }

        .to-wrapper {
          position: relative;
        }

        .to-input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 40px 12px 16px;
          border: 2px solid var(--tertiary-bg);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          color: var(--primary-text);
        }

        .to-input:focus {
          background: var(--secondary-bg);
          border-color: var(--accent-color);
        }

        .to-input:hover {
          border-color: var(--accent-color);
        }

        .to-input::placeholder {
          color: var(--secondary-text);
        }
      `}</style>
    </>
  )
}

export default SendTo
