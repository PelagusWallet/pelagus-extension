import { Worker } from "@playwright/test"

/**
 * Minimal helper for test setup and assertions via the extension's service worker.
 * All actual user flows (send, convert, etc.) should go through the real popup UI.
 */
export class ServiceWorkerHelper {
  // --- Setup helpers (not production flows) ---

  async isWalletInitialized(sw: Worker): Promise<boolean> {
    return sw.evaluate(() => {
      const main = (globalThis as any).main
      if (!main) return false
      const state = main.store.getState()
      return state.keyrings.status !== "uninitialized"
    })
  }

  async isLocked(sw: Worker): Promise<boolean> {
    return sw.evaluate(() => {
      const state = (globalThis as any).main.store.getState()
      return state.keyrings.status === "locked"
    })
  }

  async unlockWallet(sw: Worker, password: string): Promise<boolean> {
    return sw.evaluate(async (pwd: string) => {
      // Use main.unlockKeyrings which is the full production unlock path
      // (triggers keyringUnlocked dispatch, balance updates, loadQiWallet, etc.)
      return (globalThis as any).main.unlockKeyrings(pwd)
    }, password)
  }

  async waitForMain(sw: Worker, timeoutMs = 10000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const ready = await sw.evaluate(() => !!(globalThis as any).main)
      if (ready) return
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error("globalThis.main not available after timeout")
  }

  async waitForAddresses(sw: Worker, timeoutMs = 30000): Promise<void> {
    const start = Date.now()
    let lastDebug = ""
    while (Date.now() - start < timeoutMs) {
      const debug = await sw.evaluate(() => {
        const state = (globalThis as any).main.store.getState()
        const keyringsStatus = state.keyrings?.status
        const evmKeys = Object.keys(state.account?.accountsData?.evm || {})
        const utxoKeys = Object.keys(state.account?.accountsData?.utxo || {})
        const evmAddresses: Record<string, string[]> = {}
        for (const [chain, accounts] of Object.entries(state.account?.accountsData?.evm || {} as any)) {
          evmAddresses[chain] = Object.keys(accounts as any)
        }
        return JSON.stringify({ keyringsStatus, evmKeys, utxoKeys, evmAddresses })
      })
      if (debug !== lastDebug) {
        console.log(`  [waitForAddresses] ${debug}`)
        lastDebug = debug
      }
      const parsed = JSON.parse(debug)
      for (const addrs of Object.values(parsed.evmAddresses) as string[][]) {
        if (addrs.length > 0) return
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    throw new Error("No addresses in store after timeout")
  }

  async switchToQiWallet(sw: Worker): Promise<void> {
    await sw.evaluate(() => {
      const main = (globalThis as any).main
      main.store.dispatch({ type: "ui/setIsUtxoSelected", payload: true })
    })
  }

  async getCurrentChainID(sw: Worker): Promise<string> {
    return sw.evaluate(() => {
      return (globalThis as any).main.store.getState().ui.selectedAccount.network.chainID
    })
  }

  // --- Assertion helpers (read-only, for verifying test outcomes) ---

  async getQuaiAddress(sw: Worker): Promise<string> {
    return sw.evaluate(() => {
      const state = (globalThis as any).main.store.getState()
      return state.ui.selectedAccount?.address || "unknown"
    })
  }

  async getPaymentCode(sw: Worker): Promise<string> {
    return sw.evaluate(async () => {
      const qiWallet = await (globalThis as any).main.keyringService.getQiHDWallet()
      return qiWallet.getPaymentCode(0)
    })
  }

  async getQiBalance(sw: Worker): Promise<string> {
    const result = await sw.evaluate(() => {
      const state = (globalThis as any).main.store.getState()
      const network = state.ui.selectedAccount.network
      const utxoAccounts = state.account?.accountsData?.utxo?.[network.chainID]

      const debug = {
        chainID: network.chainID,
        utxoChains: Object.keys(state.account?.accountsData?.utxo || {}),
        accountKeys: utxoAccounts ? Object.keys(utxoAccounts) : [],
        balanceKeys: [] as string[],
        balances: {} as Record<string, string>,
      }

      if (utxoAccounts) {
        const firstAccount = Object.values(utxoAccounts)[0] as any
        if (firstAccount?.balances) {
          debug.balanceKeys = Object.keys(firstAccount.balances)
          for (const [key, val] of Object.entries(firstAccount.balances)) {
            debug.balances[key] = (val as any)?.assetAmount?.amount?.toString() ?? "undefined"
          }
        }
      }

      const account = utxoAccounts ? Object.values(utxoAccounts)[0] as any : null
      const balance = account?.balances?.["QI"]?.assetAmount?.amount
        ?? account?.balances?.[Object.keys(account?.balances || {})[0]]?.assetAmount?.amount
      return { balance: balance ? balance.toString() : "0", debug: JSON.stringify(debug) }
    })
    console.log(`  [getQiBalance] ${result.debug}`)
    return result.balance
  }

  async getQiLockedBalance(sw: Worker): Promise<string> {
    const result = await sw.evaluate(() => {
      const state = (globalThis as any).main.store.getState()
      const network = state.ui.selectedAccount.network
      const utxoAccounts = state.account?.accountsData?.utxo?.[network.chainID]
      if (!utxoAccounts) return "0"
      const account = Object.values(utxoAccounts)[0] as any
      const locked = account?.balances?.[Object.keys(account?.balances || {})[0]]?.lockedAmount?.amount
      return locked ? locked.toString() : "0"
    })
    return result
  }

  async isQiSyncInProgress(sw: Worker): Promise<boolean> {
    return sw.evaluate(() => {
      return (globalThis as any).main.store.getState().ui.qiWalletSyncInProgress
    })
  }

  async waitForQiSync(sw: Worker, timeoutMs = 120000): Promise<void> {
    const start = Date.now()
    // Wait for sync to start (might not have started yet)
    await new Promise((r) => setTimeout(r, 2000))
    // Then wait for it to finish
    while (Date.now() - start < timeoutMs) {
      const syncing = await this.isQiSyncInProgress(sw)
      if (!syncing) return
      await new Promise((r) => setTimeout(r, 2000))
    }
    throw new Error("Qi wallet sync timed out")
  }

  async waitForQiTransactionComplete(sw: Worker, initialBalance: string, timeoutMs = 120000): Promise<string> {
    const start = Date.now()

    // Wait for isSending to go true first (tx submission started)
    while (Date.now() - start < 15000) {
      const isSending = await sw.evaluate(() => (globalThis as any).main.store.getState().qiSend?.isSending)
      if (isSending) {
        console.log("  [waitForTx] Transaction submission started (isSending=true)")
        break
      }
      await new Promise((r) => setTimeout(r, 500))
    }

    // Now wait for isSending to go false (tx complete) AND balance to change
    while (Date.now() - start < timeoutMs) {
      const isSending = await sw.evaluate(() => (globalThis as any).main.store.getState().qiSend?.isSending)
      if (!isSending) {
        await new Promise((r) => setTimeout(r, 3000))
        const balance = await this.getQiBalance(sw)
        if (balance !== initialBalance) {
          return `confirmed (balance: ${initialBalance} → ${balance})`
        }
        console.log(`  [waitForTx] isSending=false but balance unchanged (${balance}), waiting...`)
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
    return "timeout"
  }

  async triggerQiSync(sw: Worker): Promise<void> {
    const syncInfo = await sw.evaluate(async () => {
      const main = (globalThis as any).main
      await main.chainService.syncQiWallet()
      // Read sync result from the store after sync completes
      const state = main.store.getState()
      const network = state.ui.selectedAccount.network
      const utxoAccounts = state.account?.accountsData?.utxo?.[network.chainID]
      const account = utxoAccounts ? Object.values(utxoAccounts)[0] as any : null
      const balanceKeys = account?.balances ? Object.keys(account.balances) : []
      const balances: Record<string, string> = {}
      if (account?.balances) {
        for (const [k, v] of Object.entries(account.balances)) {
          balances[k] = (v as any)?.assetAmount?.amount?.toString() ?? "?"
        }
      }
      return JSON.stringify({ chainID: network.chainID, balanceKeys, balances })
    })
    console.log(`  [triggerQiSync] After sync: ${syncInfo}`)
  }
}
