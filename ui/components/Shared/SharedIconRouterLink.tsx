import React, { ReactElement } from "react"
import { Link } from "react-router-dom"

type Props = {
  path: string
  state: { [key: string]: unknown }
  iconClass: string
  disabled?: boolean
}

export default function SharedIconRouterLink(props: Props): ReactElement {
  const { path, state, iconClass, disabled } = props

  if (disabled) {
    return (
      // @TODO Make accessible
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        className="icon_wrapper"
      >
        <i className={`disabled_asset_icon ${iconClass}`} />
      </div>
    )
  }

  return (
    <Link
      to={{
        pathname: path,
        state,
      }}
      className="router_link_container"
    >
      <div className="icon_wrapper">
        <i className={`asset_icon hoverable ${iconClass}`} />
      </div>
      <style jsx global>{`
        .router_link_container {
          margin: auto 4px;
          border-radius: 4px;
        }
        .icon_wrapper {
          display: flex;
          padding: 0.5em;
        }
        .disabled_asset_icon {
          mask-size: cover;
          background-color: var(--disabled);
          width: 12px;
          height: 12px;
        }
        .router_link_container:hover {
          background-color: var(--green-120);
          color: #ffffff;
        }
        .router_link_container:hover .asset_icon {
          background-color: #ffffff;
        }
      `}</style>
    </Link>
  )
}
