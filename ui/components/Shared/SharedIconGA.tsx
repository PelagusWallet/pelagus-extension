import React, { ReactElement } from "react"

interface SharedIconGAProps {
  width?: number
  height?: number
  iconUrl?: string
}

export default function SharedIconGA({
  width = 36,
  height = 36,
  iconUrl,
}: SharedIconGAProps): ReactElement {
  return (
    <div className="shared-icon">
      <style jsx>{`
        .shared-icon {
          background: var(--green-40)
            url("${iconUrl ?? "./images/avatar@2x.png"}") no-repeat center;
          background-size: cover;
          width: ${width}px;
          height: ${height}px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}
