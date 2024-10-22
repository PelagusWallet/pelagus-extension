import React from "react"
import ArrowRightIcon from "../../../../Shared/_newDeisgn/iconComponents/ArrowRightIcon"

const UtxoActivityDestination = ({
  receiverPaymentCode = "",
  senderPaymentCode = "",
}: {
  senderPaymentCode: string
  receiverPaymentCode: string
}) => {
  return (
    <>
      <div className="wallets">
        <div className="wallet-sender">
          <h5 className="wallet-role">Sender</h5>
          <h4 className="wallet-payment-code">
            ({senderPaymentCode.slice(0, 6)}...{senderPaymentCode.slice(-4)})
          </h4>
        </div>
        <div className="arrow">
          <ArrowRightIcon />
        </div>
        <div className="wallet-receiver">
          <h5 className="wallet-role">Receiver</h5>
          <h4 className="wallet-payment-code">
            ({receiverPaymentCode.slice(0, 6)}...
            {receiverPaymentCode.slice(-4)})
          </h4>
        </div>
      </div>
      <style jsx>
        {`
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
        `}
      </style>
    </>
  )
}

export default UtxoActivityDestination
