import React from "react"
import GoBackIcon from "../iconComponents/GoBackIcon"
import CrossIcon from "../iconComponents/CrossIcon"

const SharedModalHeaders = ({
  title,
  linkTo,
  onClose,
  onBack,
}: {
  title: string
  linkTo?:
    | {
        pathname: string
        search: string
        hash: string
        state: unknown
      }
    | string
  onClose?: () => void
  onBack?: () => void
}) => {
  return (
    <>
      <header className="header_wrapper">
        <GoBackIcon
          style={{
            position: "absolute",
            left: "0",
            top: "50%",
            transform: "translateY(-50%)",
            cursor: "pointer",
          }}
          fillColor="var(--secondary-text)"
          linkTo={linkTo}
          onClick={onBack ?? onClose}
        />
        <h2>{title}</h2>
        <CrossIcon
          style={{
            position: "absolute",
            right: "0",
            top: "50%",
            transform: "translateY(-50%)",
            cursor: "pointer",
          }}
          fillColor="var(--secondary-text)"
          onClick={onClose}
        />
      </header>
      <style jsx>{`
        .header_wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }

        h2 {
          margin: 0;
          font-weight: 700;
          font-size: 18px;
          line-height: 28px;
          color: var(--primary-text);
        }
      `}</style>
    </>
  )
}

export default SharedModalHeaders
