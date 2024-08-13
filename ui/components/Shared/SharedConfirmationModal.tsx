import React from "react"
import SharedDrawer from "./SharedDrawer"
import SharedIcon from "./SharedIcon"

interface SharedConfirmationModalProps {
  headerTitle: string
  icon?: {
    src: string
    width?: string
    height?: string
    color?: string
    padding?: string
  }
  title?: string
  subtitle?: string
  link?: { text: string; url: string }
  actionBtn?: { text: string; action: () => void }
  maxContentWidth?: string
  isOpen: boolean
  onClose: () => void
}
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const SharedConfirmationModal = ({
  headerTitle = "",
  icon = {
    src: "confirmationCheck.svg",
    height: "35",
    width: "43",
    color: "var(--success)",
    padding: "35px 32px",
  },
  title = "",
  subtitle = "",
  link = { text: "", url: "" },
  maxContentWidth = "",
  isOpen = false,
  onClose = () => {},
  actionBtn = { text: "Close", action: () => onClose() },
}: SharedConfirmationModalProps) => {
  return (
    <SharedDrawer
      title={headerTitle}
      isOpen={isOpen}
      close={onClose}
      footer={
        <button
          type="button"
          onClick={() => actionBtn?.action()}
          className="confirmation-btn"
        >
          {actionBtn?.text}
        </button>
      }
      customStyles={{ top: "0" }}
      fillAvailable
    >
      <div className="confirmation-body">
        <div className="confirmation-icon-wrapper">
          <SharedIcon
            color={icon?.color}
            width={Number(icon?.width)}
            height={Number(icon.height)}
            icon={icon?.src}
          />
        </div>
        <div
          className="confirmation-text-wrapper"
          style={{ maxWidth: `${maxContentWidth}` }}
        >
          <h3 className="confirmation-title">{title}</h3>
          <p className="confirmation-subtitle">{subtitle}</p>
        </div>

        {/* <button
          type="button"
          className="confirmation-link"
          onClick={() => window.open(link?.url, "_blank")?.focus()}
        >
          {link?.text}
        </button> */}
      </div>
      <style jsx>
        {`
          .confirmation-body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex-grow: 1;
          }
          .confirmation-icon-wrapper {
            padding: ${icon?.padding};
            background-color: var(--green-95);
            border-radius: 50%;
          }
          .confirmation-text-wrapper {
            margin: 24px 0 16px 0;
            width: 100%;
          }
          .confirmation-title {
            margin: 0;
            font-weight: 500;
            font-size: 24px;
            line-height: 38px;
            text-align: center;
            color: var(--green-40);
          }
          .confirmation-subtitle {
            margin: 0;
            font-weight: 500;
            font-size: 14px;
            line-height: 20px;
            text-align: center;
            color: var(--green-60);
          }

          .confirmation-link {
            font-weight: 500;
            font-size: 14px;
            line-height: 20px;
            color: var(--green-40);
          }

          .confirmation-link:hover {
            color: var(--white);
          }

          .confirmation-btn {
            font-weight: 500;
            line-height: 20px;
            border: 1px solid var(--green-40);
            border-radius: 4px;
            width: 100%;
            padding: 10px;
            text-align: center;
            box-sizing: border-box;
            color: var(--green-40);
          }

          .confirmation-btn:hover {
            border-color: var(--white);
            color: var(--white);
          }
        `}
      </style>
    </SharedDrawer>
  )
}

export default SharedConfirmationModal
