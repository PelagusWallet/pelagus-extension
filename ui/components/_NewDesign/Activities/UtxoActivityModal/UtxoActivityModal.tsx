import React, { useState, useEffect } from "react"
import { QiTransactionDB } from "@pelagus/pelagus-background/services/transactions/types"
import CrossIcon from "../../../Shared/_newDeisgn/iconComponents/CrossIcon"
import SharedUtxoActivityTab from "../../../Shared/_newDeisgn/utxoActivityTab/SharedUtxoActivityTab"
import UtxoActivityDestination from "./UtxoActivityDestination/UtxoActivityDestination"
import UtxoActivityInfo from "./UtxoActivityInfo/UtxoActivityInfo"
import UtxoActivityDateAndBlock from "./UtxoActivityDateAndBlock/UtxoActivityDateAndBlock"

const UtxoActivityModal = ({
  qiActivity,
  setIsOpenUtxoActivityModal,
}: {
  qiActivity: QiTransactionDB
  setIsOpenUtxoActivityModal: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => setIsOpenUtxoActivityModal(false), 300)
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
      <aside
        className={`modal-wrapper ${isVisible ? "visible" : ""}`}
        onClick={handleOverlayClick}
      >
        <div className={`modal ${isVisible ? "modal-open" : ""}`}>
          <CrossIcon
            style={{
              position: "absolute",
              top: "23px",
              right: "21px",
              cursor: "pointer",
            }}
            onClick={handleClose}
          />
          <h3 className="modal-title">Review Transaction</h3>
          <SharedUtxoActivityTab
            type={qiActivity.type}
            status={qiActivity.status}
            value={qiActivity.value}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
            activityIconBgColor="var(--tertiary-bg)"
          />
          <UtxoActivityDateAndBlock
            timestamp={qiActivity.timestamp}
            hash={qiActivity.hash}
          />
          <UtxoActivityDestination
            receiverPaymentCode={qiActivity.receiverPaymentCode}
            senderPaymentCode={qiActivity.senderPaymentCode}
          />
          <UtxoActivityInfo value={qiActivity.value} />
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
          align-items: flex-end;
          padding: 8px;
          z-index: 1000;
          box-sizing: border-box;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .modal-wrapper.visible {
          opacity: 1;
        }

        .modal {
          width: 100%;
          background: var(--secondary-bg);
          padding: 16px;
          border-radius: 12px;
          position: relative;
          transform: translateY(-20px);
          opacity: 0;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .modal-open {
          transform: translateY(0);
          opacity: 1;
        }

        .modal-title {
          text-align: center;
          font-size: 18px;
          font-weight: 700;
          line-height: 28px;
          margin: 0 0 24px;
          color: var(--primary-text);
        }
      `}</style>
    </>
  )
}

export default UtxoActivityModal
