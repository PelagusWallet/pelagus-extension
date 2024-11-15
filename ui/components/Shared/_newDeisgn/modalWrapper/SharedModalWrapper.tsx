import React, { ReactElement } from "react"

type Props = {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  header: React.ReactNode
  footer: React.ReactNode
  customStyles?: React.CSSProperties & Record<string, string>
  isFullScreen?: boolean
}

export default function SharedModalWrapper({
  isOpen,
  onClose,
  header,
  children,
  footer,
  customStyles = {},
  isFullScreen = false,
}: Props): ReactElement {
  const handleOverlayClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return <></>

  return (
    <>
      <div
        className={`modal-wrapper ${isOpen ? "visible" : ""}`}
        style={customStyles}
        onClick={handleOverlayClick}
      >
        <div
          className={`modal ${isOpen ? "modal-open" : ""}`}
          style={isFullScreen ? { height: "calc(100% - 32px)" } : {}}
        >
          <>{header}</>
          <>{children}</>
          <>{footer}</>
        </div>
      </div>

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
          align-items: flex-start;
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
          border-radius: 8px;
          position: relative;
          transform: translateY(-20px);
          opacity: 0;
          transition: transform 0.2s ease, opacity 0.2s ease;
          display: flex;
          flex-direction: column;
        }

        .modal-open {
          transform: translateY(0);
          opacity: 1;
        }
      `}</style>
    </>
  )
}
