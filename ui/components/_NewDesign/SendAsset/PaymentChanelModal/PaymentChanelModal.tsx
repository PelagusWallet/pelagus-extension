import React, { useState } from "react"
import { useHistory } from "react-router-dom"
import { updateShowPaymentChannelModal } from "@pelagus/pelagus-background/redux-slices/ui"
import CrossIcon from "../../../Shared/_newDeisgn/iconComponents/CrossIcon"
import { useBackgroundDispatch } from "../../../../hooks"

const PaymentChannelModal = ({
  setIsOpenPaymentChanelModal,
}: {
  setIsOpenPaymentChanelModal: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()

  const [dontShowAgain, setDontShowAgain] = useState(false)

  const handleDoNotShowAgain = () => {
    setDontShowAgain(!dontShowAgain)
  }

  const handleClose = () => {
    setIsOpenPaymentChanelModal(false)
  }

  const handleConfirm = async () => {
    if (dontShowAgain) await dispatch(updateShowPaymentChannelModal(false))
    history.push("/send-qi/confirmation")
  }

  const handleOverlayClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  return (
    <>
      <aside className="modal-wrapper" onClick={handleOverlayClick}>
        <div className="modal">
          <CrossIcon
            style={{
              position: "absolute",
              top: "25xpx",
              right: "25px",
              cursor: "pointer",
            }}
            onClick={handleClose}
          />
          <h3 className="modal-title">You are opening a Payment channel.</h3>
          <p className="modal-description">
            This will act as a secondary backup method. You will need to provide
            a Quai Account to fund the EVM transaction to enable this function.{" "}
            <a href="#">Learn more</a>
          </p>
          <div className="modal-footer">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={() => handleDoNotShowAgain()}
              />
              Don’t show this message again
            </label>
            <div className="button-group">
              <button
                type="button"
                className="yes-button"
                onClick={handleConfirm}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </aside>
      <style jsx>{`
        .modal-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 16px;
          z-index: 1000;
          box-sizing: border-box;
        }

        .modal {
          background: var(--secondary-bg);
          padding: 20px;
          border-radius: 12px;
          position: relative;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 700;
          line-height: 28px;
          margin: 0 0 20px;
          max-width: 275px;
          color: var(--primary-text);
        }

        .modal-description {
          font-weight: 500;
          font-size: 12px;
          line-height: 18px;
          color: var(--primary-text);
          margin: 0 0 16px;
          max-width: 310px;
        }

        .modal-description a {
          color: var(--accent-color);
          text-decoration: underline;
        }

        .modal-footer {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .checkbox-container {
          display: flex;
          flex-direction: row;
          align-items: center;
          font-weight: 500;
          line-height: 18px;
          font-size: 12px;
          color: var(--primary-text);
          gap: 8px;
        }

        .checkbox-container input {
          -webkit-appearance: none;
          appearance: none;
          border: 1px solid var(--primary-text);
          border-radius: 2px;
          width: 14px;
          height: 14px;
          cursor: pointer;
          position: relative;
        }

        .checkbox-container input:checked::before {
          content: "✔";
          color: var(--primary-text);
          position: absolute;
          top: -2px;
          left: 3px;
        }

        .button-group {
          display: flex;
          justify-content: flex-end;
        }

        .yes-button {
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          background: var(--accent-color);
          color: var(--contrast-text);
          padding: 6px 50px;
          border-radius: 4px;
          border: 1px solid var(--accent-color);
        }

        .yes-button:hover {
          opacity: 0.9;
        }
      `}</style>
    </>
  )
}

export default PaymentChannelModal
