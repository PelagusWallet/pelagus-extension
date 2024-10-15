import Dexie, { Transaction } from "dexie"

import {
  AddressOnNetwork,
  AccountSignerSettings,
  AccountSignerWithId,
} from "../../accounts"
import {
  PELAGUS_NETWORKS,
  QuaiGoldenAgeTestnet,
} from "../../constants/networks/networks"
import { FiatCurrency } from "../../assets"
import DEFAULT_PREFERENCES from "./defaults"
import { AnalyticsPreferences } from "./types"
import { getExtendedZoneForAddress } from "../chain/utils"

type SignerRecordId = `${AccountSignerWithId["type"]}/${string}`

/**
 * Returns a unique id for an account signer
 * in the form of "signerType/someId"
 */
const getSignerRecordId = (signer: AccountSignerWithId): SignerRecordId => {
  if (signer.type === "keyring") return `${signer.type}/${signer.keyringID}`

  return `${signer.type}/${signer.walletID}`
}

// The idea is to use this interface to describe the data structure stored in indexedDb
// In the future this might also have a runtime type check capability, but it's good enough for now.
export interface Preferences {
  id?: number
  savedAt: number
  tokenLists: { autoUpdate: boolean; urls: string[] }
  currency: FiatCurrency
  defaultWallet: boolean
  currentAddress?: string
  selectedAccount: AddressOnNetwork
  analytics: {
    isEnabled: boolean
    hasDefaultOnBeenTurnedOn: boolean
  }
  showDefaultWalletBanner: boolean
  showAlphaWalletBanner: boolean
  showTestNetworks: boolean
  showPelagusNotifications: boolean
  showPaymentChannelModal: boolean
}

export class PreferenceDatabase extends Dexie {
  private preferences!: Dexie.Table<Preferences, number>

  private signersSettings!: Dexie.Table<
    AccountSignerSettings & { id: SignerRecordId },
    string
  >

  constructor() {
    super("pelagus/preferences")
    this.version(1)
      .stores({
        preferences: "++id",
        signersSettings: "&id",
      })
      .upgrade(async (tx) => {
        await tx
          .table("preferences")
          .toCollection()
          .modify((storedPreferences: Preferences) => {
            const update: Partial<Preferences> = {}

            if (storedPreferences.currentAddress) {
              update.selectedAccount = {
                network: DEFAULT_PREFERENCES.selectedAccount.network,
                address: storedPreferences.currentAddress,
              }
            } else {
              update.selectedAccount = DEFAULT_PREFERENCES.selectedAccount
            }

            update.analytics = DEFAULT_PREFERENCES.analytics

            if (storedPreferences.selectedAccount?.network) {
              const updatedNetwork = PELAGUS_NETWORKS.find(
                (net) =>
                  net.chainID ===
                  storedPreferences.selectedAccount?.network?.chainID
              )
              update.selectedAccount.network =
                updatedNetwork ?? QuaiGoldenAgeTestnet
            }

            update.showDefaultWalletBanner = true

            Object.assign(storedPreferences, update)
          })
      })
    this.version(2).upgrade((tx) => {
      return tx
        .table("preferences")
        .toCollection()
        .modify((preferences: Preferences) => {
          preferences.showPaymentChannelModal = true
        })
    })

    this.on("populate", (tx: Transaction) => {
      tx.table("preferences").add(DEFAULT_PREFERENCES)
    })
  }

  async getPreferences(): Promise<Preferences> {
    // TBD: This will surely return a value because `getOrCreateDB` is called first
    // when the service is created. It runs the migration which writes the `DEFAULT_PREFERENCES`
    return this.preferences.reverse().first() as Promise<Preferences>
  }

  async setShowDefaultWalletBanner(newValue: boolean): Promise<void> {
    await this.preferences
      .toCollection()
      .modify((storedPreferences: Preferences) => {
        const update: Partial<Preferences> = {
          showDefaultWalletBanner: newValue,
        }

        Object.assign(storedPreferences, update)
      })
  }

  async setShowAlphaWalletBanner(newValue: boolean): Promise<void> {
    await this.preferences
      .toCollection()
      .modify((storedPreferences: Preferences) => {
        const update: Partial<Preferences> = {
          showAlphaWalletBanner: newValue,
        }

        Object.assign(storedPreferences, update)
      })
  }

  async setShowTestNetworks(newValue: boolean): Promise<void> {
    await this.preferences
      .toCollection()
      .modify((storedPreferences: Preferences) => {
        const update: Partial<Preferences> = {
          showTestNetworks: newValue,
        }

        Object.assign(storedPreferences, update)
      })
  }

  async setShowPaymentChannelModal(newValue: boolean): Promise<void> {
    await this.preferences
      .toCollection()
      .modify((storedPreferences: Preferences) => {
        const update: Partial<Preferences> = {
          showPaymentChannelModal: newValue,
        }

        Object.assign(storedPreferences, update)
      })
  }

  async upsertAnalyticsPreferences(
    analyticsPreferences: Partial<AnalyticsPreferences>
  ): Promise<void> {
    const preferences = await this.getPreferences()

    await this.preferences.toCollection().modify({
      analytics: {
        ...preferences.analytics,
        ...analyticsPreferences,
      },
    })
  }

  async setDefaultWalletValue(defaultWallet: boolean): Promise<void> {
    await this.preferences.toCollection().modify({ defaultWallet })
  }

  async setShowPelagusNotificationsValue(
    showPelagusNotifications: boolean
  ): Promise<void> {
    await this.preferences.toCollection().modify({ showPelagusNotifications })
  }

  async setSelectedAccount(addressNetwork: AddressOnNetwork): Promise<void> {
    const shard = getExtendedZoneForAddress(addressNetwork.address)
    globalThis.main.SetShard(shard)
    globalThis.main.chainService.getLatestBaseAccountBalance(addressNetwork)
    await this.preferences
      .toCollection()
      .modify({ selectedAccount: addressNetwork })
  }

  async getAccountSignerSettings(): Promise<AccountSignerSettings[]> {
    return this.signersSettings.toArray()
  }

  async updateSignerTitle(
    signer: AccountSignerWithId,
    title: string
  ): Promise<AccountSignerSettings[]> {
    await this.signersSettings.put({
      id: getSignerRecordId(signer),
      signer,
      title,
    })
    return this.signersSettings.toArray()
  }

  async deleteAccountSignerSettings(
    signer: AccountSignerWithId
  ): Promise<AccountSignerSettings[]> {
    await this.signersSettings.delete(getSignerRecordId(signer))
    return this.signersSettings.toArray()
  }
}

export async function initializePreferenceDatabase(): Promise<PreferenceDatabase> {
  return new PreferenceDatabase()
}
