import { SmartContractFungibleAsset } from "../assets"

const QUAI_MAINNET_CHAIN_ID = "9"
const EXPLORER_TOKEN_ICON_BASE_URL = "https://explorer.qu.ai/api/token"
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

export function getExplorerTokenIconURL(
  contractAddress: string,
  chainID: string
): string | undefined {
  if (
    chainID !== QUAI_MAINNET_CHAIN_ID ||
    !EVM_ADDRESS_PATTERN.test(contractAddress)
  ) {
    return undefined
  }

  return `${EXPLORER_TOKEN_ICON_BASE_URL}/${contractAddress.toLowerCase()}/icon`
}

export function withExplorerTokenIcon<T extends SmartContractFungibleAsset>(
  asset: T
): T {
  if (asset.metadata?.logoURL) return asset

  const logoURL = getExplorerTokenIconURL(
    asset.contractAddress,
    asset.homeNetwork.chainID
  )
  if (!logoURL) return asset

  return {
    ...asset,
    metadata: {
      ...asset.metadata,
      logoURL,
    },
  }
}
