import React, { ReactElement, useMemo } from "react"
import {
  isBuiltInNetwork,
  DISABLED_CHAINS_ID,
  DEFAULT_TEST_NETWORKS,
} from "@pelagus/pelagus-background/constants"
import { useBackgroundSelector } from "../../hooks"
import TopMenuProtocolListItemGA from "./TopMenuProtocolListItemGA"
import { EVMNetwork, sameNetwork } from "@pelagus/pelagus-background/networks"
import { selectShowTestNetworks } from "@pelagus/pelagus-background/redux-slices/ui"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { selectProductionEVMNetworks } from "@pelagus/pelagus-background/redux-slices/selectors/networks"

type TopMenuProtocolListGAProps = {
  onProtocolChange: (network: EVMNetwork) => void
}

export default function TopMenuProtocolListGA({
  onProtocolChange,
}: TopMenuProtocolListGAProps): ReactElement {
  const currentNetwork = useBackgroundSelector(selectCurrentNetwork)
  const showTestNetworks = useBackgroundSelector(selectShowTestNetworks)

  // FIXME think about how to get testnets right
  const testNetworks = DEFAULT_TEST_NETWORKS
  const productionNetworks = useBackgroundSelector(selectProductionEVMNetworks)

  const builtinNetworks = useMemo(
    () => productionNetworks.filter(isBuiltInNetwork),
    [productionNetworks]
  )

  const networks: EVMNetwork[] = useMemo(() => {
    return showTestNetworks
      ? [...builtinNetworks, ...testNetworks]
      : builtinNetworks
  }, [showTestNetworks, builtinNetworks])

  return (
    <div className="networks-list">
      <div className="networks-list-wrapper">
        {networks.map((network) => (
          <TopMenuProtocolListItemGA
            key={network.name}
            isSelected={sameNetwork(currentNetwork, network)}
            network={network}
            onSelect={onProtocolChange}
            isDisabled={DISABLED_CHAINS_ID.includes(network.chainID)}
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
