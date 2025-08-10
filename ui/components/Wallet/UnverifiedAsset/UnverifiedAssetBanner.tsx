import React, { ReactElement } from "react"
import SharedBanner, { CanBeClosedProps } from "../../Shared/SharedBanner"

export default function UnverifiedAssetBanner({
  id,
  title,
  description,
  customStyles,
  isVerified = false,
}: {
  id?: string
  title: string
  description: string
  customStyles?: string
  isVerified?: boolean
}): ReactElement {
  const props: CanBeClosedProps = id ? { canBeClosed: true, id } : {}
  return (
    <SharedBanner
      icon={isVerified ? "notif-correct" : "notif-attention"}
      iconColor={isVerified ? "var(--green-60)" : "var(--attention)"}
      customStyles={customStyles}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    >
      <div className="banner">
        <span className={`warning_text ${isVerified ? "verified" : ""}`}>{title}</span>
        <span className="simple_text">{description}</span>
      </div>
      <style jsx>{`
        .banner {
          display: flex;
          flex-direction: column;
          width: 90%;
        }
        .warning_text {
          font-size: 16px;
          line-height: 24px;
          font-weight: 500;
          color: var(--attention);
        }
        .warning_text.verified {
          color: var(--green-60);
        }
      `}</style>
    </SharedBanner>
  )
}
