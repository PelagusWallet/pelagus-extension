import React, { CSSProperties, ReactNode } from "react"

import classNames from "classnames"
import { useTranslation } from "react-i18next"
import { useDelayContentChange } from "../../hooks"
import SharedIcon from "./SharedIcon"

const SLIDE_TRANSITION_MS = 245

interface SharedDrawerProps {
  isOpen: boolean
  title: string
  close: (
    e:
      | React.MouseEvent<HTMLDivElement, MouseEvent>
      | React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => void
  showSearchBar?: boolean
  children?: ReactNode
  footer?: ReactNode
  isScrollable?: boolean
  isDark?: boolean
  alwaysRenderChildren?: boolean
  customStyles?: React.CSSProperties & Record<string, string>
  fillAvailable?: boolean
  titleWithoutSidePaddings?: boolean
  gap?: number
}

export default function SharedDrawer({
  isOpen = false,
  title,
  close,
  showSearchBar,
  children,
  footer,
  isDark,
  isScrollable,
  alwaysRenderChildren,
  customStyles = {},
  fillAvailable = false,
  titleWithoutSidePaddings = false,
  gap = 24,
}: SharedDrawerProps) {
  const handleOverlayClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (e.target === e.currentTarget) {
      close(e)
    }
  }

  const visibleChildren = isOpen || alwaysRenderChildren ? children : <></>
  const displayChildren = useDelayContentChange(
    visibleChildren,
    !isOpen,
    SLIDE_TRANSITION_MS
  )

  const { t: tShared } = useTranslation("translation", { keyPrefix: "shared" })

  return (
    <>
      <div
        className={classNames("drawer-overlay theme", { closed: !isOpen })}
        onClick={handleOverlayClick}
      />
      <div
        className={classNames("drawer-wrapper", {
          dark: isDark,
          closed: !isOpen,
          fillAvailable,
        })}
        style={
          {
            ...customStyles,
          } as CSSProperties
        }
      >
        <div className="drawer-header-wrapper">
          <div className="drawer-header">
            <h1 className="drawer-header-text">{title}</h1>
            <SharedIcon
              icon="close.svg"
              width={14}
              height={14}
              color="var(--primary-text)"
              hoverColor="var(--secondary-text)"
              ariaLabel={tShared("close")}
              onClick={close}
              customStyles={`
                margin-right: 5px;
              `}
            />
          </div>
          {/* FIXME create search bar component */}
          {showSearchBar && <div className="drawer-search"></div>}
        </div>
        <div
          className={classNames("drawer-body", {
            fillAvailable,
          })}
        >
          {displayChildren}
        </div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
      <style jsx>{`
        .drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          cursor: pointer;
          z-index: 998;
          background: var(--secondary-bg);
          transition: opacity cubic-bezier(0.19, 1, 0.22, 1)
              ${SLIDE_TRANSITION_MS}ms,
            visibility ${SLIDE_TRANSITION_MS}ms;
        }
        .drawer-overlay.closed {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .dark {
          background-color: var(--primary-bg);
        }

        .fillAvailable {
          flex-grow: 1;
          height: -webkit-fill-available;
        }

        .drawer-wrapper {
          overflow-x: hidden;
          overflow-y: ${isScrollable ? "auto" : "hidden"};
          position: fixed;
          left: 0px;
          right: 0px;
          z-index: 999;
          transform: translateY(0);
          display: flex;
          align-items: center;
          flex-direction: column;
          justify-content: start;
          gap: ${gap}px;
          margin: 10px;
          padding: 24px 16px;
          border-radius: 16px;
          opacity: 1;
          background-color: var(--primary-bg);
          transition: transform cubic-bezier(0.19, 1, 0.22, 1)
            ${SLIDE_TRANSITION_MS}ms;
        }
        .drawer-wrapper.closed {
          transform: translateY(${fillAvailable ? "100%" : "300%"});
          transition: transform cubic-bezier(0.19, 1, 0.22, 1)
              ${fillAvailable
                ? `${SLIDE_TRANSITION_MS}ms`
                : `${SLIDE_TRANSITION_MS * 2}ms`},
            opacity 0ms ${SLIDE_TRANSITION_MS}ms;
          opacity: 0;
          pointer-events: none;
        }

        .drawer-header-wrapper {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .drawer-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: ${titleWithoutSidePaddings ? "0 16px" : 0};
        }

        .drawer-body {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .drawer-footer {
          width: 100%;
        }

        .drawer-header-text {
          flex: 1;
          margin: 0;
          font-size: 16px;
          font-weight: 500;
          line-height: 24px;
          text-align: start;
          color: var(--primary-text);
        }

        .drawer-footer {
          width: 100%;
        }
      `}</style>
    </>
  )
}
