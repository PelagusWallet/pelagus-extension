import { Core } from "@walletconnect/core"
import { WalletKit, WalletKitTypes } from "@reown/walletkit"
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils"
import BaseService from "../base"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import { PELAGUS_NETWORKS } from "../../constants/networks/networks"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import { getAddress } from "quais"
import logger from "../../lib/logger"
import { SessionTypes } from '@walletconnect/types'
import { AllowedQueryParamPage } from "@pelagus-provider/provider-bridge-shared"
import showExtensionPopup from "../provider-bridge/show-popup"
import { setPendingProposal, clearPendingProposal, addActiveSession } from "../../redux-slices/wallet-connect"

type Events = ServiceLifecycleEvents & {
  sessionProposal: WalletKitTypes.SessionProposal
  sessionRequest: WalletKitTypes.SessionRequest
  sessionDelete: { topic: string }
}

export default class WalletConnectService extends BaseService<Events> {
  public walletKit: InstanceType<typeof WalletKit> | null = null
  private pendingProposal: WalletKitTypes.SessionProposal | null = null
  private activeSessions: SessionTypes.Struct[] = []

  static create: ServiceCreatorFunction<Events, WalletConnectService, []> = async () => {
    return new this()
  }

  constructor() {
    super()
  }

  async initialize(projectId: string): Promise<void> {
    if (this.walletKit) {
      logger.warn("WalletConnectService already initialized")
      return
    }

    if (!projectId) {
      throw new Error("WalletConnect project ID is required")
    }

    try {
      const core = new Core({
        projectId,
      })

      this.walletKit = await WalletKit.init({
        core,
        metadata: {
          name: "Pelagus Wallet",
          description: "Pelagus Browser Extension Wallet",
          url: "https://pelaguswallet.io",
          icons: ["https://pelaguswallet.io/docs/img/PelagusLogoSquare.png"],
        },
      })

      this.setupEventListeners()
      logger.info("WalletConnect service initialized successfully")
    } catch (error) {
      logger.error("Failed to initialize WalletConnect service:", error)
      throw error
    }
  }

  private setupEventListeners(): void {
    if (!this.walletKit) {
      throw new Error("WalletKit not initialized")
    }

    this.walletKit.on("session_proposal", (proposal: WalletKitTypes.SessionProposal) => {
      this.pendingProposal = proposal
      this.emitter.emit("sessionProposal", proposal)

      // Store the proposal in Redux
      globalThis.main.store.dispatch(setPendingProposal({
        id: proposal.id,
        dappName: proposal.params.proposer.metadata.name,
        dappUrl: proposal.params.proposer.metadata.url,
        dappIcon: proposal.params.proposer.metadata.icons[0]
      }))

      // Open the popup window for the user to approve/reject the connection
      showExtensionPopup(AllowedQueryParamPage.walletConnect, {
        proposalId: proposal.id.toString(),
        dappName: proposal.params.proposer.metadata.name,
        dappUrl: proposal.params.proposer.metadata.url,
        dappIcon: proposal.params.proposer.metadata.icons[0]
      })
    })

    this.walletKit.on("session_request", (request: WalletKitTypes.SessionRequest) => {
      this.emitter.emit("sessionRequest", request)
      
      // Store the request in Redux and open the WalletConnect page
      globalThis.main.store.dispatch(setPendingProposal({
        id: request.id,
        dappName: request.verifyContext.verified.origin,
        dappUrl: request.verifyContext.verified.origin,
        dappIcon: request.verifyContext.verified.origin + "/favicon.ico"
      }))

      // Open the popup window for the user to approve/reject the request
      showExtensionPopup(AllowedQueryParamPage.walletConnect, {
        proposalId: request.id.toString(),
        dappName: request.verifyContext.verified.origin,
        dappUrl: request.verifyContext.verified.origin,
        dappIcon: request.verifyContext.verified.origin + "/favicon.ico"
      })
    })

    this.walletKit.on("session_delete", (event: WalletKitTypes.SessionDelete) => {
      this.pendingProposal = null
      globalThis.main.store.dispatch(clearPendingProposal())
      // Always emit an object with a topic property
      const topic = event && typeof event === 'object' && 'topic' in event ? event.topic : ''
      this.emitter.emit("sessionDelete", { topic })
    })
  }

  async approveSession(proposalId: number, accounts: string[]): Promise<void> {
    if (!this.walletKit) throw new Error("WalletKit not initialized")
    if (!this.pendingProposal) throw new Error("No pending proposal")

    const supportedNamespaces = {
      eip155: {
        chains: PELAGUS_NETWORKS.map(network => `eip155:${network.chainID}`),
        methods: [
          "eth_sendTransaction",
          "eth_signTransaction",
          "eth_sign",
          "personal_sign",
          "eth_signTypedData",
          "eth_signTypedData_v3",
          "eth_signTypedData_v4",
          "wallet_switchEthereumChain",
          "wallet_addEthereumChain",
          "wallet_watchAsset"
        ],
        events: ["chainChanged", "accountsChanged"],
        accounts: accounts.flatMap(addr => 
          PELAGUS_NETWORKS.map(net => `eip155:${net.chainID}:${getAddress(addr)}`)
        )
      }
    }

    try {
      const approvedNamespaces = buildApprovedNamespaces({
        proposal: this.pendingProposal.params,
        supportedNamespaces
      })

      let session = await this.walletKit.approveSession({
        id: proposalId,
        namespaces: approvedNamespaces
      })
      this.activeSessions.push(session)
      
      // Add session to Redux store
      globalThis.main.store.dispatch(addActiveSession({
        topic: session.topic,
        dappName: session.peer.metadata.name,
        dappUrl: session.peer.metadata.url,
        dappIcon: session.peer.metadata.icons[0]
      }))

      // Only clear after session is successfully added
      this.pendingProposal = null
      globalThis.main.store.dispatch(clearPendingProposal())
    } catch (error) {
      logger.error("Error approving session:", error)
      await this.walletKit.rejectSession({
        id: proposalId,
        reason: getSdkError("USER_REJECTED")
      })
      this.pendingProposal = null
      globalThis.main.store.dispatch(clearPendingProposal())
    }
  }

  async rejectSession(proposalId: number): Promise<void> {
    if (!this.walletKit) throw new Error("WalletKit not initialized")
    await this.walletKit.rejectSession({
      id: proposalId,
      reason: getSdkError("USER_REJECTED")
    })
  }

  async respondToRequest(topic: string, response: any): Promise<void> {
    if (!this.walletKit) throw new Error("WalletKit not initialized")
    await this.walletKit.respondSessionRequest({
      topic,
      response
    })
  }

  async disconnectSession(topic: string): Promise<void> {
    if (!this.walletKit) throw new Error("WalletKit not initialized")
    await this.walletKit.disconnectSession({
      topic,
      reason: getSdkError("USER_DISCONNECTED")
    })
    this.activeSessions = this.activeSessions.filter(session => session.topic !== topic)
  }

  public getActiveSessions(): Record<string, SessionTypes.Struct> {
    if (!this.walletKit) {
      throw new Error('WalletKit not initialized')
    }
    return this.walletKit.getActiveSessions()
  }
} 