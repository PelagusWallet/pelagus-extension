import { FunctionFragment, Interface, InterfaceAbi } from "quais"

export interface AggregateContractResponse {
  blockNumber: BigInt
  returnData: Array<{
    success: true
    returnData: string
  }>
}

export const MULTICALL_CONTRACT_ADDRESS =
  "0x15b6351eDEcd7142ac4c6fE54948b603D4566862" // TODO: Different for each network. Must be deployed on all shards!

export const CHAIN_SPECIFIC_MULTICALL_CONTRACT_ADDRESSES = {
  "17000": "0x15b6351eDEcd7142ac4c6fE54948b603D4566862", // cyprus1 local
} as { [chainId: string]: string }

const MULTICALL_FUNCTIONS = {
  aggregate: FunctionFragment.from(
    "function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)"
  ),
  aggregate3: FunctionFragment.from(
    "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)"
  ),
  aggregate3Value: FunctionFragment.from(
    "function aggregate3Value(tuple(address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)"
  ),
  blockAndAggregate: FunctionFragment.from(
    "function blockAndAggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes32 blockHash, tuple(bool success, bytes returnData)[] returnData)"
  ),
  getBasefee: FunctionFragment.from(
    "function getBasefee() view returns (uint256 basefee)"
  ),
  getBlockHash: FunctionFragment.from(
    "function getBlockHash(uint256 blockNumber) view returns (bytes32 blockHash)"
  ),
  getBlockNumber: FunctionFragment.from(
    "function getBlockNumber() view returns (uint256 blockNumber)"
  ),
  getChainId: FunctionFragment.from(
    "function getChainId() view returns (uint256 chainid)"
  ),
  getCurrentBlockCoinbase: FunctionFragment.from(
    "function getCurrentBlockCoinbase() view returns (address coinbase)"
  ),
  getCurrentBlockDifficulty: FunctionFragment.from(
    "function getCurrentBlockDifficulty() view returns (uint256 difficulty)"
  ),
  getCurrentBlockGasLimit: FunctionFragment.from(
    "function getCurrentBlockGasLimit() view returns (uint256 gaslimit)"
  ),
  getCurrentBlockTimestamp: FunctionFragment.from(
    "function getCurrentBlockTimestamp() view returns (uint256 timestamp)"
  ),
  getEthBalance: FunctionFragment.from(
    "function getEthBalance(address addr) view returns (uint256 balance)"
  ),
  getLastBlockHash: FunctionFragment.from(
    "function getLastBlockHash() view returns (bytes32 blockHash)"
  ),
  tryAggregate: FunctionFragment.from(
    "function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)"
  ),
  tryBlockAndAggregate: FunctionFragment.from(
    "function tryBlockAndAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes32 blockHash, tuple(bool success, bytes returnData)[] returnData)"
  ),
}

const MULTICALL_ABI: InterfaceAbi = [...Object.values(MULTICALL_FUNCTIONS)]

export const MULTICALL_INTERFACE = new Interface(MULTICALL_ABI)
