import React, { ReactElement, useState, useEffect } from "react"
import { NetworkInterface } from "@pelagus/pelagus-background/constants/networks/networkTypes"
import { QuaiLocalNodeNetwork } from "@pelagus/pelagus-background/constants/networks/networks"
import {
  getNetworkIcon,
  getNetworkIconFallbackColor,
} from "../../utils/networks"

export default function SharedNetworkIcon(props: {
  network: NetworkInterface
  size: number
  hasBackground?: boolean
  backgroundOpacity?: number
  padding?: number
}): ReactElement {
  const {
    network,
    size,
    hasBackground = false,
    backgroundOpacity = 1,
    padding = 0,
  } = props
  const [currentSource, setCurrentSource] = useState(0)

  const sources = [getNetworkIcon(network)].filter((source): source is string =>
    Boolean(source)
  )

  const hasIconAvailable = currentSource < sources.length

  useEffect(() => {
    if (sources.length < 1 || !hasIconAvailable) return

    const img = new Image()

    img.onerror = () => {
      setCurrentSource(currentSource + 1)
    }

    img.src = sources[currentSource]
  }, [currentSource, sources, hasIconAvailable])

  return (
    <div className="icon_network_wrapper">
      {hasBackground && hasIconAvailable && (
        <div className="icon_network_background" />
      )}
      {hasIconAvailable ? (
        <div className="icon_network" />
      ) : (
        <div className="icon_fallback">
          {network.baseAsset.name.toUpperCase() ?? network.chainID}
        </div>
      )}
      <style jsx>{`
        .icon_network_wrapper {
          position: relative;
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon_network_background {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 6px;
          background-color: ${hasBackground
            ? "var(--green-95)"
            : "transparent"};
          opacity: ${backgroundOpacity};
        }
        .icon_fallback {
          background: ${getNetworkIconFallbackColor(network)};
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          color: var(--white);
          border-radius: 2px;
        }
        .icon_network {
          background: url("${sources[currentSource]}");
          background-size: cover;
          height: ${size - padding}px;
          width: ${size - padding}px;
          z-index: 1;
          border-radius: 50%;
          background-color: ${network.chainID === QuaiLocalNodeNetwork.chainID
            ? "var(--green-40)"
            : "transparent"};
        }
      `}</style>
    </div>
  )
}
