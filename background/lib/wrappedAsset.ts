import { BigNumber, ethers } from "ethers"
import { EventFragment, Fragment, FunctionFragment } from "ethers/lib/utils"
import { EVMLog } from "../networks"
import { HexString } from "../types"
import { ERC20_FUNCTIONS } from "./erc20"

export const WRAPPED_ASSET_FUNCTIONS = {
  ...ERC20_FUNCTIONS,
  deposit: FunctionFragment.from("deposit() public payable"),
  withdraw: FunctionFragment.from("withdraw(uint amount) public"),
}

const WRAPPED_ASSET_EVENTS = {
  Deposit: EventFragment.from("Deposit(address indexed dst, uint amount)"),
  Withdrawal: EventFragment.from(
    "Withdrawal(address indexed src, uint amount)"
  ),
}

export const WRAPPED_ASSET_ABI = Object.values<Fragment>(
  WRAPPED_ASSET_FUNCTIONS
).concat(Object.values(WRAPPED_ASSET_EVENTS))

export const WRAPPED_ASSET_INTERFACE = new ethers.utils.Interface(
  WRAPPED_ASSET_ABI
)

export type WrappedAssetDepositLog = {
  contractAddress: string
  amount: bigint
  senderAddress: HexString
  recipientAddress: HexString
}

/**
 * Parses the given list of EVM logs, returning information on any contained
 * Wrapped Deposits.
 *
 * Note that the returned data should only be considered valid if the logs are
 * from a known asset address; this function does not check the asset address,
 * it only tries to blindly parse each log as if it were an ERC20 Deposit
 * event.
 *
 * @param logs An arbitrary list of EVMLogs, some of which may represent ERC20
 *        `Deposit` events.
 * @return Information on any logs that were parsable as `Deposit` or `Withdrawal`
 *         events. This does _not_ mean they are guaranteed to be Wrapped
 *         `Deposit` or `Withdrawal` events, simply that they can be parsed as such.
 */
export function parseLogsForWrappedDepositsAndWithdrawals(
  logs: EVMLog[]
): WrappedAssetDepositLog[] {
  return logs
    .map(({ contractAddress, data, topics }) => {
      try {
        const decodedDeposit = WRAPPED_ASSET_INTERFACE.decodeEventLog(
          WRAPPED_ASSET_EVENTS.Deposit,
          data,
          topics
        )

        if (
          typeof decodedDeposit.amount !== "undefined" &&
          typeof decodedDeposit.dst !== "undefined"
        )
          return {
            contractAddress,
            amount: (decodedDeposit.amount as BigNumber).toBigInt(),
            recipientAddress: decodedDeposit.dst,
            senderAddress: contractAddress,
          }
      } catch (e) {
        // swallow the error if we can't decode a Deposit - try to decode Withdrawal
      }
      try {
        const decodedWithdrawal = WRAPPED_ASSET_INTERFACE.decodeEventLog(
          WRAPPED_ASSET_EVENTS.Withdrawal,
          data,
          topics
        )

        if (
          typeof decodedWithdrawal.amount !== "undefined" &&
          typeof decodedWithdrawal.src !== "undefined"
        )
          return {
            contractAddress,
            amount: (decodedWithdrawal.amount as BigNumber).toBigInt(),
            recipientAddress: contractAddress,
            senderAddress: decodedWithdrawal.src,
          }
      } catch (_) {
        return undefined
      }
      return undefined
    })
    .filter(
      (info): info is WrappedAssetDepositLog => typeof info !== "undefined"
    )
}
