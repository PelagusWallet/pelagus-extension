import React from "react"
import ConfirmWrapAmount from "./ConfirmWrapAmount"
import ConfirmWrapDestination from "./ConfirmWrapDestination"

interface ConfirmWrapProps {
  isUnwrap?: boolean
}

const ConfirmWrap: React.FC<ConfirmWrapProps> = ({ isUnwrap = false }) => {
  return (
    <>
      <ConfirmWrapAmount isUnwrap={isUnwrap} />
      {!isUnwrap && <ConfirmWrapDestination />}
      {isUnwrap && (
        <div className="unwrap-info">
          <p>Your unwrapped Qi will be sent to an available address in your Qi wallet.</p>
          <style jsx>{`
            .unwrap-info {
              padding: 12px;
              background-color: rgba(33, 150, 243, 0.1);
              border-radius: 8px;
              margin: 16px 0;
            }
            .unwrap-info p {
              margin: 0;
              font-size: 14px;
              color: var(--primary-text);
              text-align: center;
            }
          `}</style>
        </div>
      )}
    </>
  )
}

export default ConfirmWrap 