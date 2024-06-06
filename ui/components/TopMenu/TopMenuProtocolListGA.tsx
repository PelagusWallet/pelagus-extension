import React, { ReactElement, useMemo } from "react"
import {
  isBuiltInNetwork,
  isTestNetwork,
} from "@pelagus/pelagus-background/constants"
import {
  EVMNetwork,
  sameNetwork,
  EVMTestNetwork,
} from "@pelagus/pelagus-background/networks"
import { selectShowTestNetworks } from "@pelagus/pelagus-background/redux-slices/ui"
import {
  selectProductionEVMNetworks,
  selectTestNetworksWithAvailabilityFlag,
} from "@pelagus/pelagus-background/redux-slices/selectors/networks"
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
  const testNetworksWithAvailabilityFlag = useBackgroundSelector(
    selectTestNetworksWithAvailabilityFlag
  )
  const networks: EVMNetwork[] | EVMTestNetwork[] = useMemo(() => {
    const builtinNetworks = productionNetworks.filter(isBuiltInNetwork)

    return showTestNetworks
      ? [...builtinNetworks, ...testNetworksWithAvailabilityFlag]
      : builtinNetworks
  }, [showTestNetworks, productionNetworks, testNetworksWithAvailabilityFlag])

  const isDisabledHandle = (network: EVMNetwork & EVMTestNetwork) => {
    if (isTestNetwork(network) && !isEnabled("SUPPORT_TEST_NETWORKS")) {
      return true
    }
    return isTestNetwork(network) && !network?.isAvailable
  }

  return (
    <div className="networks-list">
      <div className="networks-list-wrapper">
        {networks.map((network) => (
          <TopMenuProtocolListItemGA
            key={network.name}
            network={network}
            isSelected={sameNetwork(currentNetwork, network)}
            onSelect={onProtocolListItemSelect}
            isDisabled={isDisabledHandle(network as EVMTestNetwork)}
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
