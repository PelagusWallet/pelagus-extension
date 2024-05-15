import { ETHEREUM } from "../../constants"
import { AssetsState } from "../../redux-slices/assets"

const assets: AssetsState = [
  {
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    homeNetwork: ETHEREUM,
    contractAddress: "0x0",
    recentPrices: {
      USD: {
        pair: [
          {
            contractAddress: "0x0",
            decimals: 18,
            homeNetwork: ETHEREUM,
            name: "Wrapped Ether",
            symbol: "WETH",
          },
          {
            name: "United States Dollar",
            symbol: "USD",
            decimals: 10,
          },
        ],
        amounts: [1000000000000000000n, 31288400000000n],
        time: 1650540050,
      },
    },
  },
]

export default assets
