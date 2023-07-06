import { BigNumber } from "ethers"

// Forked from https://github.com/joshstevens19/ethereum-multicall

export interface AggregateContractResponse {
  blockNumber: BigNumber
  returnData: Array<{
    success: true
    returnData: string
  }>
}

export const MULTICALL_CONTRACT_ADDRESS =
  "0x15b6351eDEcd7142ac4c6fE54948b603D4566862" // TODO: Different for each network. Must be deployed on all shards!

export const CHAIN_SPECIFIC_MULTICALL_CONTRACT_ADDRESSES = {
  "324": "0x47898B2C52C957663aE9AB46922dCec150a2272c", // zksync era
  "1337": "0x15b6351eDEcd7142ac4c6fE54948b603D4566862", // cyprus1 local
} as { [chainId: string]: string }

export const MULTICALL_ABI = [
  // https://github.com/mds1/multicall
  "function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)",
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)",
  "function aggregate3Value(tuple(address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)",
  "function blockAndAggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes32 blockHash, tuple(bool success, bytes returnData)[] returnData)",
  "function getBasefee() view returns (uint256 basefee)",
  "function getBlockHash(uint256 blockNumber) view returns (bytes32 blockHash)",
  "function getBlockNumber() view returns (uint256 blockNumber)",
  "function getChainId() view returns (uint256 chainid)",
  "function getCurrentBlockCoinbase() view returns (address coinbase)",
  "function getCurrentBlockDifficulty() view returns (uint256 difficulty)",
  "function getCurrentBlockGasLimit() view returns (uint256 gaslimit)",
  "function getCurrentBlockTimestamp() view returns (uint256 timestamp)",
  "function getEthBalance(address addr) view returns (uint256 balance)",
  "function getLastBlockHash() view returns (bytes32 blockHash)",
  "function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)",
  "function tryBlockAndAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes32 blockHash, tuple(bool success, bytes returnData)[] returnData)",
]
