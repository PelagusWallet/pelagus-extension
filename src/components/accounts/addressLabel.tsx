import { useEffect, useState } from "react"

import { getShardFromAddress } from "~storage/wallet"

import "../../style.css"

const shardColors = {
  prime: "bg-stone-200",
  cyprus: "bg-green-700 ",
  "cyprus-1": "bg-green-600 ",
  "cyprus-2": "bg-green-500 ",
  "cyprus-3": "bg-green-400 ",
  paxos: "bg-red-700 ",
  "paxos-1": "bg-red-600 ",
  "paxos-2": "bg-red-500 ",
  "paxos-3": "bg-red-400 ",
  hydra: "bg-blue-700 ",
  "hydra-1": "bg-blue-600 ",
  "hydra-2": "bg-blue-500 ",
  "hydra-3": "bg-blue-400 "
}

export default function AddressLabel({ address }) {
  const [shard, setShard] = useState<string>()

  useEffect(() => {
    if (!address) return
    let shardData = getShardFromAddress(address)
    if (shardData) {
      setShard(shardData[0].shard)
    }
  }, [address])
  return (
    <div
      className={
        shardColors[shard] +
        " rounded-full my-auto flex flex-row justify-center space-x-1 px-2 min-w-[70px] text-center"
      }>
      <span className="my-auto">{shard}</span>
    </div>
  )
}
