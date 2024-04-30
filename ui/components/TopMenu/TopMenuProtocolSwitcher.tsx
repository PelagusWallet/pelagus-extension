import React, { ReactElement } from "react"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { useBackgroundSelector } from "../../hooks"
import SharedNetworkIcon from "../Shared/SharedNetworkIcon"

type Props = {
  onClick?: () => void
}

export default function TopMenuProtocolSwitcher({
  onClick,
}: Props): ReactElement {
  const currentNetwork = useBackgroundSelector(selectCurrentNetwork)
  return (
    <button
      type="button"
      onClick={() => onClick?.()}
      data-testid="top_menu_network_switcher"
    >
      <SharedNetworkIcon
        key={currentNetwork.chainID}
        size={20}
        network={currentNetwork}
      />
      <span className="icon_chevron_down" />
      <style jsx>
        {`
          button {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 9px;
            user-select: none;
            max-width: 72px;
            width: 100%;
            padding: 6px 13px 6px 10px;
            border-radius: 35px;
            background-color: var(--green-95);
            box-sizing: border-box;
          }

          .icon_chevron_down {
            flex-shrink: 0;
            mask-image: url("./images/chevron_down.svg");
            mask-size: 11px 7px;
            width: 11px;
            height: 7px;
            background-color: var(--green-40);
          }
        `}
      </style>
    </button>
  )
}
