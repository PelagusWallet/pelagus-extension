import {
  selectShowAlphaWalletBanner,
  selectAlphaBannerVersion,
  updateAlphaWalletBanner,
} from "@pelagus/pelagus-background/redux-slices/ui"
import classNames from "classnames"
import React, { ReactElement, useState, useEffect } from "react"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import { CURRENT_BANNER_VERSION } from "../../utils/constants"

// Current version of the banner - increment this when the message changes

export default function WalletAlphaBanner(): ReactElement {
  const dispatch = useBackgroundDispatch()
  const showAlphaWalletBanner = useBackgroundSelector(
    selectShowAlphaWalletBanner
  )

  const alphaBannerVersion = useBackgroundSelector(selectAlphaBannerVersion)

  // Only check version on mount, don't auto-show if manually hidden
  useEffect(() => {
    if (
      !showAlphaWalletBanner &&
      (!alphaBannerVersion || alphaBannerVersion < CURRENT_BANNER_VERSION)
    ) {
      dispatch(updateAlphaWalletBanner(true))
    }
  }, [showAlphaWalletBanner, alphaBannerVersion, dispatch]) // Empty deps array - only run once on mount

  const [isHidden, setIsHidden] = useState(!showAlphaWalletBanner)

  // Update local state when redux changes
  useEffect(() => {
    setIsHidden(!showAlphaWalletBanner)
  }, [showAlphaWalletBanner])

  const hideAlphaWalletBanner = () => {
    dispatch(updateAlphaWalletBanner(false))
  }

  return (
    <div
      className={classNames("default_toggle_container", {
        hidden: isHidden,
      })}
    >
      <div className="default_toggle">
        <div className="banner-content">
          {/* <button
            type="button"
            className="crossBtn"
            onClick={hideAlphaWalletBanner}
            aria-label="Close banner"
          >
            &#10005;
          </button> */}
          <div className="message-container">
            <span className="header">Coming soon</span>
            <span className="body">
              Up to <span className="highlight">25% yield</span> on Quai!
            </span>
          </div>
          <a
            href="https://docs.qu.ai/learn/use-quai"
            target="_blank"
            rel="noopener noreferrer"
            className="link"
          >
            Learn more →
          </a>
        </div>
      </div>
      <style jsx>{`
        .default_toggle {
          display: flex;
          align-items: center;
          box-sizing: border-box;
          width: 100%;
          background: var(--secondary-bg);
          font-weight: 500;
          font-size: 16px;
          line-height: 24px;
          padding: 12px 16px;
          border-radius: 12px;
          box-shadow: var(--shadow-light);
          border: 1px solid var(--tertiary-bg);
        }
        .banner-content {
          display: flex;
          align-items: center;
          width: 100%;
          gap: 16px;
        }
        .default_toggle_container {
          margin-bottom: 16px;
          width: calc(100% - 16px);
        }
        .default_toggle_container.hidden {
          opacity: 0;
          height: 0;
          margin-bottom: 0;
          pointer-events: none;
          transform: translateY(-10px);
          transition: all 300ms ease-out;
        }
        .message-container {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }
        .header {
          color: var(--primary-text);
          font-size: 16px;
          font-weight: 600;
        }
        .body {
          color: var(--primary-text);
          font-size: 15px;
        }
        .highlight {
          color: var(--accent-color);
          font-weight: 600;
        }
        .crossBtn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--tertiary-bg);
          border: none;
          cursor: pointer;
          transition: all 200ms ease;
          padding: 0;
          font-size: 14px;
          color: var(--secondary-text);
        }
        .crossBtn:hover {
          background: var(--accent-color);
          color: var(--contrast-text);
          transform: rotate(90deg);
        }
        .link {
          color: var(--accent-color);
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 200ms ease;
          white-space: nowrap;
          padding: 6px 12px;
          border-radius: 6px;
        }
        .link:hover {
          background: var(--accent-color);
          color: var(--contrast-text);
          text-decoration: none;
        }
      `}</style>
    </div>
  )
}
