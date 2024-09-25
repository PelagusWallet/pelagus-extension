import { EventFragment, FunctionFragment, Interface, InterfaceAbi } from "quais"

export const ERC20_FUNCTIONS = {
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
    "transfer(address to, uint256 amount) returns (bool)"
  ),
  transferFrom: FunctionFragment.from(
    "transferFrom(address from, address to, uint256 amount) returns (bool)"
  ),
  crossChainTransfer: FunctionFragment.from(
    "crossChainTransfer(address to, uint256 amount, uint256 gasLimit, uint256 minerTip, uint256 baseFee)"
  ),
}

export const ERC20_EVENTS = {
  Transfer: EventFragment.from(
    "Transfer(address indexed from, address indexed to, uint256 amount)"
  ),
  Approval: EventFragment.from(
    "Approval(address indexed owner, address indexed spender, uint256 amount)"
  ),
}

export const ERC20_ABI: InterfaceAbi = [
  ...Object.values(ERC20_FUNCTIONS),
  ...Object.values(ERC20_EVENTS),
]
export const ERC20_INTERFACE: Interface = new Interface(ERC20_ABI)
