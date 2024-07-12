import { Interface, EventFragment, FunctionFragment, InterfaceAbi } from "quais"

const QRC20_EVENTS = {
  Transfer: EventFragment.from(
    "Transfer(address indexed from, address indexed to, uint amount)"
  ),
  Approval: EventFragment.from(
    "Approval(address indexed owner, address indexed spender, uint amount)"
  ),
}

const QRC20_FUNCTIONS = {
  allowance: FunctionFragment.from(
    "allowance(address owner, address spender) view returns (uint256)"
  ),
  approve: FunctionFragment.from(
    "approve(address spender, uint256 value) returns (bool)"
  ),
  balanceOf: FunctionFragment.from(
    "balanceOf(address owner) view returns (uint256)"
  ),
  decimals: FunctionFragment.from("decimals() view returns (uint8)"),
  name: FunctionFragment.from("name() view returns (string)"),
  symbol: FunctionFragment.from("symbol() view returns (string)"),
  totalSupply: FunctionFragment.from("totalSupply() view returns (uint256)"),
  transfer: FunctionFragment.from(
    "transfer(address to, uint amount) returns (bool)"
  ),
  transferFrom: FunctionFragment.from(
    "transferFrom(address from, address to, uint amount) returns (bool)"
  ),
  crossChainTransfer: FunctionFragment.from(
    "crossChainTransfer(address to, uint256 amount, uint256 gasLimit, uint256 minerTip, uint256 baseFee)"
  ),
}

const QRC20_ABI: InterfaceAbi = [
  ...Object.values(QRC20_FUNCTIONS),
  ...Object.values(QRC20_EVENTS),
]

export const QRC20_INTERFACE = new Interface(QRC20_ABI)
