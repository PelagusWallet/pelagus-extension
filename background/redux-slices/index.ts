import { combineReducers } from "redux"

import accountsReducer from "./accounts"
import assetsReducer from "./assets"
import activitiesReducer from "./activities"
import keyringsReducer from "./keyrings"
import networksReducer from "./networks"
import transactionConstructionReducer from "./transaction-construction"
import uiReducer from "./ui"
import dappReducer from "./dapp"
import signingReducer from "./signing"
import qiSendReducer from "./qiSend"
import convertAssetsReducer from "./convertAssets"
import walletConnectReducer from "./wallet-connect"

const mainReducer = combineReducers({
  account: accountsReducer,
  assets: assetsReducer,
  activities: activitiesReducer,
  keyrings: keyringsReducer,
  networks: networksReducer,
  transactionConstruction: transactionConstructionReducer,
  ui: uiReducer,
  dapp: dappReducer,
  signing: signingReducer,
  qiSend: qiSendReducer,
  convertAssets: convertAssetsReducer,
  walletConnect: walletConnectReducer,
})

export default mainReducer

export type RootState = ReturnType<typeof mainReducer>
