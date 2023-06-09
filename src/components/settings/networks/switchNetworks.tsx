import "../../../style.css"

import { ChevronLeftIcon } from "@heroicons/react/24/outline"
import _ from "lodash"
import React from "react"
import { useEffect, useState } from "react"
import { useLocation } from "wouter"

import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import type { Network } from "~background/services/network/chains"
import NetworkData from "~components/settings/networks/networkData"
import {
  getAllNetworks,
  setActiveNetwork,
  updateCustomNetwork
} from "~storage/network"

function SwitchNetworks({ activeNetwork }) {
  const [, setLocation] = useLocation()
  const [allNetworks, setAllNetworks] = useState<Network[]>([])

  const [customNetworks] = useStorage<Network[]>({
    key: "custom_networks",
    instance: new Storage({
      area: "local"
    })
  })

  useEffect(() => {
    getAllNetworks().then((networks) => {
      setAllNetworks(networks)
    })
  }, [customNetworks])

  async function handleNetworkChange(network: Network) {
    await setActiveNetwork(network.name)
  }

  async function handleNetworkUpdate(oldNetwork: Network, newNetwork: Network) {
    await updateCustomNetwork(oldNetwork, newNetwork)
    if (activeNetwork.name === oldNetwork.name) {
      await setActiveNetwork(newNetwork.name)
    }
  }

  return (
    <div>
      <div className="p-6">
        <div className="flex flex-row justify-between items-baseline">
          <div className="cursor-default text-lg font-thin">Networks</div>
          <div
            className="cursor-pointer text-md font-thin align-text-bottom"
            onClick={() => setLocation("/settings/network/add")}>
            +Add Custom Network
          </div>
        </div>
        <div className="relative mx-2 pb-6 flex flex-col">
          {allNetworks.map((network, i) => {
            return (
              <div className="pb-6" key={`network-${i}`}>
                <NetworkData
                  network={network}
                  editable={network.isCustom}
                  selected={network.name === activeNetwork?.name}
                  onNetworkSelect={(e) => handleNetworkChange(e)}
                  onNetworkUpdate={(oldNetwork, newNetwork) =>
                    handleNetworkUpdate(oldNetwork, newNetwork)
                  }
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function arePropsEqual(prevProps, nextProps) {
  // Return true if the nextProps are equal to prevProps, otherwise return false.
  // In this case, we only compare the activeNetwork prop.
  return _.isEqual(prevProps.activeNetwork, nextProps.activeNetwork)
}

export default React.memo(SwitchNetworks, arePropsEqual)
