import React, { ReactElement, useState, useMemo } from "react"
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
  setIsProtocolListOpen: (value: React.SetStateAction<boolean>) => void
  onProtocolListItemSelect: (network: EVMNetwork) => void
  customCurrentSelectedNetwork?: EVMNetwork
}

export default function SelectNetworkDrawer({
  isProtocolListOpen,
  setIsProtocolListOpen,
  onProtocolListItemSelect,
  customCurrentSelectedNetwork,
}: SelectNetworkDrawerProps): ReactElement {
  const dispatch = useBackgroundDispatch()
  const { t } = useTranslation("translation", {
    keyPrefix: "drawers.selectNetwork",
  })

  const currentNetwork = customCurrentSelectedNetwork
    ? customCurrentSelectedNetwork
    : useBackgroundSelector(selectCurrentNetwork)
  const showTestNetworks = useBackgroundSelector(selectShowTestNetworks)
  const [isTestNetworksSwitchDisabled, setIsTestNetworksSwitchDisabled] =
    useState<boolean>(false)

  const toggleShowTestNetworks = (defaultWalletValue: boolean) =>
    dispatch(toggleTestNetworks(defaultWalletValue))

  useMemo(
    () =>
      setIsTestNetworksSwitchDisabled(
        isTestNetwork(currentNetwork) ? true : false
      ),
    [currentNetwork]
  )

  return (
    <SharedDrawer
      title={t("title")}
      isOpen={isProtocolListOpen}
      close={() => {
        setIsProtocolListOpen(false)
      }}
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
            onChange={(toggleValue) => toggleShowTestNetworks(toggleValue)}
          />
        )}
      />
    </SharedDrawer>
  )
}
