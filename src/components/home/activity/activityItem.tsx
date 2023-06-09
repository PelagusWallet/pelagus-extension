import {
  BsCheck2,
  BsCheck2All,
  BsSend,
  BsSendCheck,
  BsSendX,
  BsXOctagon
} from "react-icons/bs"
import { GrRevert } from "react-icons/gr"
import {
  HiOutlineArrowPath,
  HiOutlineArrowPathRoundedSquare
} from "react-icons/hi2"

import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import { getExplorerURLForShard } from "~background/services/network/chains"
import type { Network } from "~background/services/network/chains"
import { formatBalance } from "~utils/format"

const storage = new Storage({ area: "local" })

export default function ActivityItem({ activity }) {
  const [activeNetwork] = useStorage<Network>({
    key: "active_network",
    instance: storage
  })

  // Support Quaiscan by default
  function linkToExplorer(shard: string, txHash: string): string {
    if (shard == undefined || txHash == undefined) {
      return ""
    }
    const explorerURL = getExplorerURLForShard(activeNetwork, shard)
    const url = explorerURL + "/tx/" + txHash
    window.open(url, "_blank")
  }

  function getSymbolOrNative(activity: any) {
    if (activity.tokenSymbol) {
      return activity.tokenSymbol
    } else {
      return "QUAI"
    }
  }

  function isNative(activity: any) {
    if (activity.tokenSymbol) {
      return false
    } else {
      return true
    }
  }

  function formatTimestamp(timeStamp: any) {
    const date = new Date(timeStamp * 1000)
    return date.toLocaleString()
  }

  if (activity.status === "pending") {
    return (
      <div
        onClick={() => linkToExplorer(activity.shard, activity.hash)}
        className="w-full cursor-pointer secondary-bg-container py-2 px-4 rounded-lg shadow-inner space-y-2">
        <div className="flex flex-row space-x-4">
          <div className="flex my-auto">
            {(() => {
              switch (activity.type) {
                case "send":
                  return (
                    <BsSend className="text-zinc-600 dark:text-zinc-400 w-7 h-7" />
                  )
                case "transfer":
                  return (
                    <HiOutlineArrowPath className="text-zinc-600 dark:text-zinc-400 w-7 h-7" />
                  )
                case "receive":
                  return (
                    <BsCheck2 className="text-zinc-600 dark:text-zinc-400 w-7 h-7" />
                  )
                default:
                  return null
              }
            })()}
          </div>
          <div className="flex flex-col w-full my-auto">
            <div className="flex justify-between">
              <div className="text-md">
                {(() => {
                  switch (activity.type) {
                    case "send":
                      return <div>Sending</div>
                    case "transfer":
                      return <div>Transfering</div>
                    case "receive":
                      return <div>Receiving</div>

                    default:
                      return null
                  }
                })()}
              </div>
              {activity.input != "0x" ? (
                <div className="font-semibold text-md">
                  Contract Interaction
                </div>
              ) : (
                <div className="font-semibold text-md">
                  {formatBalance(activity.value, false) +
                    " " +
                    getSymbolOrNative(activity)}
                </div>
              )}{" "}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (activity.isError === "1") {
    return (
      <div
        onClick={() => linkToExplorer(activity.shard, activity.hash)}
        className="w-full cursor-pointer secondary-bg-container py-2 px-4 rounded-lg shadow-inner space-y-2">
        <div className="flex flex-row space-x-4">
          <div className="flex my-auto">
            {(() => {
              switch (activity.type) {
                case "send":
                  return (
                    <BsSendX className="text-red-600 dark:text-red-400 w-7 h-7" />
                  )
                case "transfer":
                  return (
                    <GrRevert className="text-red-600 dark:text-red-400 w-7 h-7" />
                  )
                case "receive":
                  return (
                    <BsXOctagon className="text-red-600 dark:text-red-400 w-7 h-7" />
                  )
                default:
                  return null
              }
            })()}
          </div>
          <div className="flex flex-col w-full">
            <div className="flex justify-between">
              <div className="font-semibold">
                {(() => {
                  switch (activity.type) {
                    case "send":
                      return <div>Send failed</div>
                    case "transfer":
                      return <div>Transfer failed</div>
                    case "receive":
                      return <div>Receive failed</div>

                    default:
                      return null
                  }
                })()}
              </div>
              {getSymbolOrNative(activity) !== "QUAI" ? (
                <div className="">
                  {formatBalance(activity.value, isNative(activity))}{" "}
                  {getSymbolOrNative(activity)}
                </div>
              ) : (
                <div className="">
                  {formatBalance(activity.value, false)} QUAI
                </div>
              )}
            </div>
            <div className="flex justify-between"></div>
            <div className="flex justify-between">
              <div className="">{formatTimestamp(activity.timeStamp)}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        onClick={() => linkToExplorer(activity.shard, activity.hash)}
        className="w-full cursor-pointer secondary-bg-container py-2 px-4 rounded-lg shadow-inner space-y-2">
        <div className="flex flex-row space-x-4">
          <div className="flex my-auto">
            {(() => {
              switch (activity.type) {
                case "send":
                  return (
                    <BsSendCheck className="text-blue-600 dark:text-blue-400 w-7 h-7" />
                  )
                case "transfer":
                  return (
                    <HiOutlineArrowPathRoundedSquare className="text-blue-600 dark:text-blue-400 w-7 h-7" />
                  )
                case "receive":
                  return (
                    <BsCheck2All className="text-blue-600 dark:text-blue-400 w-7 h-7" />
                  )
                default:
                  return null
              }
            })()}
          </div>
          <div className="flex flex-col w-full">
            <div className="flex justify-between">
              <div className="font-semibold">
                {(() => {
                  switch (activity.type) {
                    case "send":
                      return <div>Sent</div>
                    case "transfer":
                      return <div>Transferred</div>
                    case "receive":
                      return <div>Received</div>

                    default:
                      return null
                  }
                })()}
              </div>
              {getSymbolOrNative(activity) !== "QUAI" ? (
                <div className="">
                  {formatBalance(activity.value, isNative(activity))}{" "}
                  {getSymbolOrNative(activity)}
                </div>
              ) : (
                <div className="">
                  {formatBalance(activity.value, false)} QUAI
                </div>
              )}
            </div>
            <div className="flex justify-between"></div>
            <div className="flex justify-between">
              <div className="">{formatTimestamp(activity.timeStamp)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
