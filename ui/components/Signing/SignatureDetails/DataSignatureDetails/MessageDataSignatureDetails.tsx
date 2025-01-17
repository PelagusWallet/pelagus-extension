import { assertUnreachable } from "@pelagus/pelagus-background/lib/utils/type-guards"
import { MessageSigningRequest } from "@pelagus/pelagus-background/utils/signing"
import React, { ReactElement } from "react"
import EIP191Info from "../../../SignData/EIP191Info"
import DataSignatureDetails from "."
import EIP4361Info from "../../../SignData/EIP4361Info"
import EIP191InfoQiAddresses, {
  DataQiSignatureDetails,
} from "../../../SignData/EIP191InfoQiAddresses"

export type MessageDataSignatureDetailsProps = {
  messageRequest: MessageSigningRequest
}

export default function MessageDataSignatureDetails({
  messageRequest,
}: MessageDataSignatureDetailsProps): ReactElement {
  switch (messageRequest.messageType) {
    case "eip191":
      if (messageRequest.coin === "qi") {
        return (
          <DataQiSignatureDetails>
            <EIP191InfoQiAddresses
              account={messageRequest.account.address}
              internal={false}
              excludeHeader
              signingData={messageRequest.signingData}
            />
          </DataQiSignatureDetails>
        )
      }
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
    case "eip4361":
      return (
        <DataSignatureDetails
          requestingSource={messageRequest.signingData.domain}
          excludeTitle
        >
          <EIP4361Info signingData={messageRequest.signingData} />
        </DataSignatureDetails>
      )
    default:
      return assertUnreachable(messageRequest as never)
  }
}
