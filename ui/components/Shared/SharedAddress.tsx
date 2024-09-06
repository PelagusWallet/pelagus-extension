import { truncateAddress } from "@pelagus/pelagus-background/lib/utils"
import { setSnackbarConfig } from "@pelagus/pelagus-background/redux-slices/ui"
import { NameResolverSystem } from "@pelagus/pelagus-background/services/name"
import classNames from "classnames"
import React, { ReactElement, useCallback } from "react"
import { useBackgroundDispatch } from "../../hooks"
import SharedTooltip from "./SharedTooltip"

type SharedAddressProps = {
  address: string
  name?: string | undefined
  elide: boolean
  nameResolverSystem?: NameResolverSystem
  alwaysShowAddress: boolean
}

export default function SharedAddress({
  name,
  address,
  elide,
  nameResolverSystem,
  alwaysShowAddress,
}: SharedAddressProps): ReactElement {
  const dispatch = useBackgroundDispatch()

  const primaryText = name ?? truncateAddress(address)

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(address)
    dispatch(setSnackbarConfig({ message: "Address copied to clipboard" }))
  }, [address, dispatch])

  return (
    <button
      type="button"
      onClick={copyAddress}
      title={`Copy to clipboard:\n${address}`}
      className={classNames({ ellipsis: elide })}
    >
      <p className={classNames({ ellipsis: elide })}>
        {primaryText}
        {name === undefined || nameResolverSystem === undefined ? (
          <></>
        ) : (
          <>
            <SharedTooltip width={130}>
              <p className="name_source_tooltip">
                Resolved using {nameResolverSystem}
              </p>
            </SharedTooltip>{" "}
          </>
        )}
      </p>
      {alwaysShowAddress && name !== undefined ? (
        <p className="detail">{truncateAddress(address)}</p>
      ) : (
        <></>
      )}
      <style jsx>{`
        button {
          transition: 300ms color;
          max-width: 100%;
        }
        button :last-child {
          top: 3px;
        }
        button:hover {
          color: var(--gold-80);
        }
        .name_source_tooltip {
          margin: 0;
          text-align: center;
        }
        p {
          font-size: 16px;
          line-height: 24px;
          margin: 0;
        }
        p.detail {
          font-size: 14px;
          line-height: 16px;
          color: var(--green-40);
        }
      `}</style>
    </button>
  )
}

SharedAddress.defaultProps = {
  alwaysShowAddress: false,
  elide: false,
}
