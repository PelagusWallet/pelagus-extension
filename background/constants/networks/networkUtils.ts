import { NetworkInterfaceGA } from "./networkTypes"

export const isQuaiHandle = (network: NetworkInterfaceGA) =>
  network.family === "EVM"
