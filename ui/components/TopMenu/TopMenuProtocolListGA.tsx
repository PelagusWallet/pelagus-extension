import React, { ReactElement, useMemo } from "react"
import {
  isBuiltInNetwork,
  DEFAULT_TEST_NETWORKS,
} from "@pelagus/pelagus-background/constants"
import { useBackgroundSelector } from "../../hooks"
import TopMenuProtocolListItemGA from "./TopMenuProtocolListItemGA"
import { EVMNetwork, sameNetwork } from "@pelagus/pelagus-background/networks"
import { selectShowTestNetworks } from "@pelagus/pelagus-background/redux-slices/ui"
import { selectProductionEVMNetworks } from "@pelagus/pelagus-background/redux-slices/selectors/networks"

type TopMenuProtocolListGAProps = {
  currentNetwork: EVMNetwork
  onProtocolListItemSelect: (network: EVMNetwork) => void
}

export default function TopMenuProtocolListGA({
  currentNetwork,
  onProtocolListItemSelect,
}: TopMenuProtocolListGAProps): ReactElement {
  const showTestNetworks = useBackgroundSelector(selectShowTestNetworks)
  const productionNetworks = useBackgroundSelector(selectProductionEVMNetworks)

  const networks: EVMNetwork[] = useMemo(() => {
    const builtinNetworks = productionNetworks.filter(isBuiltInNetwork)

    return showTestNetworks
      ? [...builtinNetworks, ...DEFAULT_TEST_NETWORKS]
      : builtinNetworks
  }, [showTestNetworks, productionNetworks])

  return (
    <div className="networks-list">
      <div className="networks-list-wrapper">
        {networks.map((network) => (
          <TopMenuProtocolListItemGA
            key={network.name}
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
