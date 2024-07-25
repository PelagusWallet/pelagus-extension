import React, { ReactElement } from "react"
import { sameNetwork } from "@pelagus/pelagus-background/networks"
import { selectQuaiNetworks } from "@pelagus/pelagus-background/redux-slices/selectors/networks"
import { NetworkInterface } from "@pelagus/pelagus-background/constants/networks/networkTypes"
import { useBackgroundSelector } from "../../hooks"
import TopMenuProtocolListItemGA from "./TopMenuProtocolListItemGA"

type TopMenuProtocolListGAProps = {
  currentNetwork: NetworkInterface
  onProtocolListItemSelect: (network: NetworkInterface) => void
  showTestNetworks: boolean
}

export default function TopMenuProtocolListGA({
  currentNetwork,
  onProtocolListItemSelect,
  showTestNetworks,
}: TopMenuProtocolListGAProps): ReactElement {
  const quaiNetworks = useBackgroundSelector(selectQuaiNetworks)
    .filter((network) => showTestNetworks || !network.isTestNetwork)
    .sort((a, b) =>
      (a.isTestNetwork === b.isTestNetwork ? 0 : a.isTestNetwork) ? 1 : -1
    )

  return (
    <div className="networks-list">
      <div className="networks-list-wrapper">
        {quaiNetworks.map((network) => (
          <TopMenuProtocolListItemGA
            key={network.baseAsset.name}
            network={network}
            isSelected={sameNetwork(currentNetwork, network)}
            isDisabled={network.isDisabled}
            onSelect={onProtocolListItemSelect}
          />
        ))}
      </div>
      <style jsx>
        {`
          .networks-list {
            display: flex;
            flex-direction: column;
            min-height: auto;
            overflow-y: auto;
            overflow-x: hidden;
            margin: 0 -16px;
          }
          .networks-list-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
        `}
      </style>
    </div>
  )
}
