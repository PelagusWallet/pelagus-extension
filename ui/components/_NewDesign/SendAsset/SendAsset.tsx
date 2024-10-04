import React from "react"
import SourceWallet from "./SourceWallet/SourceWallet"
import SendTo from "./SendTo/SendTo"
import Amount from "./Amount/Amount"

const SendAsset = () => {
  return (
    <>
      <SourceWallet />
      <SendTo />
      <Amount />
    </>
  )
}

export default SendAsset
