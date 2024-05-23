import { assertUnreachable } from "@pelagus/pelagus-background/lib/utils/type-guards"
import { MessageSigningRequest } from "@pelagus/pelagus-background/utils/signing"
import React, { ReactElement } from "react"
import EIP191Info from "../../../SignData/EIP191Info"
import DataSignatureDetails from "."

export type MessageDataSignatureDetailsProps = {
  messageRequest: MessageSigningRequest
}

export default function MessageDataSignatureDetails({
  messageRequest,
}: MessageDataSignatureDetailsProps): ReactElement {
  switch (messageRequest.messageType) {
    case "eip191":
      return (
        <DataSignatureDetails>
          <EIP191Info
            account={messageRequest.account.address}
            internal={false}
            excludeHeader
            signingData={messageRequest.signingData}
          />
        </DataSignatureDetails>
      )
    default:
      return assertUnreachable(messageRequest as never)
  }
}
