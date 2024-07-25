import React, { ReactElement, useMemo, useLayoutEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  selectShowTestNetworks,
  updateShowTestNetworks,
} from "@pelagus/pelagus-background/redux-slices/ui"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { NetworkInterface } from "@pelagus/pelagus-background/constants/networks/networkTypes"
import SharedDrawer from "../Shared/SharedDrawer"
import TopMenuProtocolListGA from "../TopMenu/TopMenuProtocolListGA"
import SharedToggleButtonGA from "../Shared/SharedToggleButtonGA"
import SharedToggleSwitchRow from "../Shared/SharedToggleSwitchRow"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"

interface SelectNetworkDrawerProps {
  isProtocolListOpen: boolean
  onProtocolListClose: () => void
  onProtocolListItemSelect: (network: NetworkInterface) => void
  customCurrentSelectedNetwork?: NetworkInterface
}

export default function SelectNetworkDrawer({
  isProtocolListOpen,
  onProtocolListClose,
  onProtocolListItemSelect,
  customCurrentSelectedNetwork,
}: SelectNetworkDrawerProps): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "drawers.selectNetwork",
  })

  const dispatch = useBackgroundDispatch()
  const currentNetwork =
    useBackgroundSelector(selectCurrentNetwork) || customCurrentSelectedNetwork
  const showTestNetworks = useBackgroundSelector(selectShowTestNetworks)

  const toggleShowTestNetworks = (toggleValue: boolean) =>
    dispatch(updateShowTestNetworks(toggleValue))

  const isTestNetworksSwitchDisabled = useMemo(
    () => currentNetwork.isTestNetwork,
    [currentNetwork]
  )

  useLayoutEffect(() => {
    if (currentNetwork.isTestNetwork) toggleShowTestNetworks(true)
  }, [showTestNetworks])

  return (
    <SharedDrawer
      title={t("title")}
      isOpen={isProtocolListOpen}
      close={onProtocolListClose}
    >
      <TopMenuProtocolListGA
        currentNetwork={currentNetwork}
        onProtocolListItemSelect={onProtocolListItemSelect}
        showTestNetworks={showTestNetworks}
      />
      <SharedToggleSwitchRow
        title={t("toggleShowTestNetworks")}
        component={() => (
          <SharedToggleButtonGA
            value={showTestNetworks}
            isDisabled={isTestNetworksSwitchDisabled}
            onChange={toggleShowTestNetworks}
          />
        )}
      />
    </SharedDrawer>
  )
}
