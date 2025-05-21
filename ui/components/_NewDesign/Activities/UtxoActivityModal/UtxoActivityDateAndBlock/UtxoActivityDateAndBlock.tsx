import React from "react"
import { utxoActivityTimestampHandle } from "@pelagus/pelagus-background/redux-slices/utils/utxo-activities-utils"
import { QUAI_SCAN_URL } from "@pelagus/pelagus-background/constants"
import { getBlockExplorerURL } from "../../../../../utils/networks"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { useBackgroundSelector } from "../../../../../hooks"

const UtxoActivityDateAndBlock = ({
  hash,
  timestamp,
}: {
  hash: string
  timestamp: number
}) => {
  const network = useBackgroundSelector(selectCurrentNetwork)
  const blockExplorerUrl = network.blockExplorerURL

  return (
    <>
      <div className="activity-timestamp-block">
        <h5 className="activity-timestamp">
          {utxoActivityTimestampHandle(timestamp)}
        </h5>
        <a
          href={`${blockExplorerUrl}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="activity-block-explorer"
        >
          View on block explorer
        </a>
      </div>
      <style jsx>{`
        .activity-timestamp-block {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 500;
          font-size: 12px;
          line-height: 18px;
          margin-bottom: 24px;
        }

        .activity-timestamp {
          margin: 0;
          color: var(--secondary-text);
        }

        .activity-block-explorer {
          color: var(--accent-color);
        }
      `}</style>
    </>
  )
}

export default UtxoActivityDateAndBlock
