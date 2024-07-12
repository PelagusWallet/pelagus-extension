import {
  selectShowAlphaWalletBanner,
  updateAlphaWalletBanner,
} from "@pelagus/pelagus-background/redux-slices/ui"
import classNames from "classnames"
import React, { ReactElement, useState } from "react"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"

export default function WalletAlphaBanner(): ReactElement {
  const dispatch = useBackgroundDispatch()
  const showAlphaWalletBanner = useBackgroundSelector(
    selectShowAlphaWalletBanner
  )

  const [isHidden, setIsHidden] = useState(!showAlphaWalletBanner)

  const hideAlphaWalletBanner = async () => {
    await dispatch(updateAlphaWalletBanner(false))
    setIsHidden(true)
  }

  return (
    <div
      className={classNames("default_toggle_container", {
        hidden: isHidden,
      })}
    >
      <div className="default_toggle">
        <div>
          <button
            type="button"
            className="crossBtn"
            onClick={hideAlphaWalletBanner}
          >
            &#10005;
          </button>
          {`Welcome to Pelagus Alpha version. Help improve Pelagus by reporting issues `}
          <a
            href="https://support.pelaguswallet.io"
            target="_blank"
            rel="noopener noreferrer"
            className="link"
          >
            here
          </a>
        </div>
      </div>
      <style jsx>{`
        .default_toggle {
          display: flex;
          align-items: center;
          box-sizing: border-box;
          width: 100%;
          background-color: var(--green-120);
          font-weight: 500;
          font-size: 16px;
          line-height: 24px;
          padding: 8px;
          border-radius: 8px;
        }
        .default_toggle_container {
          margin-bottom: 8px;
          width: calc(100% - 16px);
        }
        .default_toggle_container.hidden {
          opacity: 0;
          height: 0;
          margin-bottom: 0;
          pointer-events: none;
          transition: all 500ms;
        }
        .highlight {
          color: var(--trophy-gold);
        }
        .crossBtn {
          margin-right: 8px;
        }

        .crossBtn:hover {
          color: var(--trophy-gold);
        }

        .link {
          color: var(--trophy-gold);
          text-decoration: none;
        }
      `}</style>
    </div>
  )
}
