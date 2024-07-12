import React, { ReactElement, useMemo } from "react"
import { sameNetwork } from "@pelagus/pelagus-background/networks"
import { selectShowTestNetworks } from "@pelagus/pelagus-background/redux-slices/ui"
import { selectProductionEVMNetworks } from "@pelagus/pelagus-background/redux-slices/selectors/networks"
import { useBackgroundSelector } from "../../hooks"
import TopMenuProtocolListItemGA from "./TopMenuProtocolListItemGA"
import { NetworkInterfaceGA } from "@pelagus/pelagus-background/constants/networks/networkTypes"
import { NetworksArray } from "@pelagus/pelagus-background/constants/networks/networks"

type TopMenuProtocolListGAProps = {
  currentNetwork: NetworkInterfaceGA
  onProtocolListItemSelect: (network: NetworkInterfaceGA) => void
}

export default function TopMenuProtocolListGA({
  currentNetwork,
  onProtocolListItemSelect,
}: TopMenuProtocolListGAProps): ReactElement {
  const showTestNetworks = useBackgroundSelector(selectShowTestNetworks)
  const productionNetworks = useBackgroundSelector(selectProductionEVMNetworks)

  const networks: NetworkInterfaceGA[] = useMemo(() => {
    // TODO-MIGRATION: Add test network
    return showTestNetworks ? NetworksArray : NetworksArray
  }, [showTestNetworks, productionNetworks])

  return (
    <div className="networks-list">
      <div className="networks-list-wrapper">
        {networks.map((network) => (
          <TopMenuProtocolListItemGA
            key={network.baseAsset.name}
            network={network}
            isSelected={sameNetwork(currentNetwork, network)}
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
