import React, { ReactElement, useMemo, useLayoutEffect } from "react"
import { useTranslation } from "react-i18next"
import SharedDrawer from "../Shared/SharedDrawer"
import {
  selectShowTestNetworks,
  toggleTestNetworks,
} from "@pelagus/pelagus-background/redux-slices/ui"
import TopMenuProtocolListGA from "../TopMenu/TopMenuProtocolListGA"
import SharedToggleButtonGA from "../Shared/SharedToggleButtonGA"
import SharedToggleSwitchRow from "../Shared/SharedToggleSwitchRow"
import { isTestNetwork } from "@pelagus/pelagus-background/constants"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { EVMNetwork } from "@pelagus/pelagus-background/networks"

interface SelectNetworkDrawerProps {
  isProtocolListOpen: boolean
  onProtocolListClose: () => void
  onProtocolListItemSelect: (network: EVMNetwork) => void
  customCurrentSelectedNetwork?: EVMNetwork
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
    customCurrentSelectedNetwork || useBackgroundSelector(selectCurrentNetwork)
  const showTestNetworks = useBackgroundSelector(selectShowTestNetworks)

  const toggleShowTestNetworks = (toggleValue: boolean) =>
    dispatch(toggleTestNetworks(toggleValue))

  const isTestNetworksSwitchDisabled = useMemo(
    () => isTestNetwork(currentNetwork),
    [currentNetwork]
  )

  useLayoutEffect(() => {
    if (isTestNetwork(currentNetwork)) toggleShowTestNetworks(true)
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
