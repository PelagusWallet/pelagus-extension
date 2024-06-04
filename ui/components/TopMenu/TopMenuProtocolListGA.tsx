import React, { ReactElement, useMemo } from "react"
import {
  isBuiltInNetwork,
  DEFAULT_TEST_NETWORKS,
  isTestNetwork,
} from "@pelagus/pelagus-background/constants"
import { EVMNetwork, sameNetwork } from "@pelagus/pelagus-background/networks"
import { selectShowTestNetworks } from "@pelagus/pelagus-background/redux-slices/ui"
import { selectProductionEVMNetworks } from "@pelagus/pelagus-background/redux-slices/selectors/networks"
import { isEnabled } from "@pelagus/pelagus-background/features"
import { useBackgroundSelector } from "../../hooks"
import TopMenuProtocolListItemGA from "./TopMenuProtocolListItemGA"

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

  const isDisabled = (network: EVMNetwork) =>
    isTestNetwork(network) && !isEnabled("SUPPORT_TEST_NETWORKS")

  return (
    <div className="networks-list">
      <div className="networks-list-wrapper">
        {networks.map((network) => (
          <TopMenuProtocolListItemGA
            key={network.name}
            network={network}
            isSelected={sameNetwork(currentNetwork, network)}
            onSelect={onProtocolListItemSelect}
            isDisabled={isDisabled(network)}
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
