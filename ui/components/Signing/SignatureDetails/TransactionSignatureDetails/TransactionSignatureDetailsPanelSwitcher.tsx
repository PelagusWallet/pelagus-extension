import React, { ReactElement } from "react"
import { QuaiTransactionRequestWithAnnotation } from "@pelagus/pelagus-background/services/chain/types"
import { useSwitchablePanels } from "../../../../hooks"
import DetailsPanel from "./DetailsPanel"
import RawDataPanel from "./RawDataPanel"

export default function TransactionDataPanelSwitcher({
  transactionRequest,
}: {
  transactionRequest: QuaiTransactionRequestWithAnnotation
}): ReactElement {
  const switchablePanels = useSwitchablePanels([
    {
      name: "Details",
      panelElement: () => (
        <DetailsPanel transactionRequest={transactionRequest} />
      ),
    },
    {
      name: "Raw data",
      panelElement: () => (
        <RawDataPanel transactionRequest={transactionRequest} />
      ),
    },
  ])

  return <>{switchablePanels}</>
}
