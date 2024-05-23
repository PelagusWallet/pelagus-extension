import { FiatCurrency } from "../../assets"
import { AddressOnNetwork, NameOnNetwork } from "../../accounts"
import { ServiceLifecycleEvents, ServiceCreatorFunction } from "../types"

import {
  AnalyticsPreferences,
  Preferences,
  TokenListPreferences,
} from "./types"
import { getOrCreateDB, PreferenceDatabase } from "./db"
import BaseService from "../base"
import { normalizeEVMAddress } from "../../lib/utils"
import { EVMNetwork, sameNetwork } from "../../networks"
import { HexString } from "../../types"
import { AccountSignerSettings } from "../../ui"
import { AccountSignerWithId } from "../../signing"

type AddressBookEntry = {
  network: EVMNetwork
  address: HexString
  name: string
}

type InMemoryAddressBook = AddressBookEntry[]

const sameAddressBookEntry = (a: AddressOnNetwork, b: AddressOnNetwork) =>
  normalizeEVMAddress(a.address) === normalizeEVMAddress(b.address) &&
  sameNetwork(a.network, b.network)

interface Events extends ServiceLifecycleEvents {
  preferencesChanges: Preferences
  initializeDefaultWallet: boolean
  initializeSelectedAccount: AddressOnNetwork
  updateAnalyticsPreferences: AnalyticsPreferences
  addressBookEntryModified: AddressBookEntry
  updatedSignerSettings: AccountSignerSettings[]
  showDefaultWalletBanner: boolean
}

/*
 * The preference service manages user preference persistence, emitting an
 * event when preferences change.
 */
export default class PreferenceService extends BaseService<Events> {
  private addressBook: InMemoryAddressBook = []

  /*
   * Create a new PreferenceService. The service isn't initialized until
   * startService() is called and resolved.
   */
  static create: ServiceCreatorFunction<Events, PreferenceService, []> =
    async () => {
      const db = await getOrCreateDB()

      return new this(db)
    }

  private constructor(private db: PreferenceDatabase) {
    super()
  }

  protected override async internalStartService(): Promise<void> {
    await super.internalStartService()

    this.emitter.emit("initializeDefaultWallet", await this.getDefaultWallet())
    this.emitter.emit(
      "initializeSelectedAccount",
      await this.getSelectedAccount()
    )
    this.emitter.emit(
      "updateAnalyticsPreferences",
      await this.getAnalyticsPreferences()
    )
  }

  protected override async internalStopService(): Promise<void> {
    this.db.close()

    await super.internalStopService()
  }

  // TODO Implement the following 6 methods as something stored in the database and user-manageable.
  // TODO Track account names in the UI in the address book.

  addOrEditNameInAddressBook(newEntry: AddressBookEntry): void {
    const correspondingEntryIndex = this.addressBook.findIndex((entry) =>
      sameAddressBookEntry(newEntry, entry)
    )
    if (correspondingEntryIndex !== -1) {
      this.addressBook[correspondingEntryIndex] = newEntry
    } else {
      this.addressBook.push({
        network: newEntry.network,
        name: newEntry.name,
        address: normalizeEVMAddress(newEntry.address),
      })
    }
    this.emitter.emit("addressBookEntryModified", newEntry)
  }

  lookUpAddressForName({
    name,
    network,
  }: NameOnNetwork): AddressOnNetwork | undefined {
    return this.addressBook.find(
      ({ name: entryName, network: entryNetwork }) =>
        sameNetwork(network, entryNetwork) && name === entryName
    )
  }

  lookUpNameForAddress(
    addressOnNetwork: AddressOnNetwork
  ): NameOnNetwork | undefined {
    return this.addressBook.find((addressBookEntry) =>
      sameAddressBookEntry(addressBookEntry, addressOnNetwork)
    )
  }

  async deleteAccountSignerSettings(
    signer: AccountSignerWithId
  ): Promise<void> {
    const updatedSignerSettings = await this.db.deleteAccountSignerSettings(
      signer
    )

    this.emitter.emit("updatedSignerSettings", updatedSignerSettings)
  }

  async updateAccountSignerTitle(
    signer: AccountSignerWithId,
    title: string
  ): Promise<void> {
    const updatedSignerSettings = this.db.updateSignerTitle(signer, title)

    this.emitter.emit("updatedSignerSettings", await updatedSignerSettings)
  }

  async getAnalyticsPreferences(): Promise<Preferences["analytics"]> {
    return (await this.db.getPreferences())?.analytics
  }

  async updateAnalyticsPreferences(
    analyticsPreferences: Partial<AnalyticsPreferences>
  ): Promise<void> {
    await this.db.upsertAnalyticsPreferences(analyticsPreferences)
    const { analytics } = await this.db.getPreferences()

    // This step is not strictly needed, because the settings can only
    // be changed from the UI
    this.emitter.emit("updateAnalyticsPreferences", analytics)
  }

  async getAccountSignerSettings(): Promise<AccountSignerSettings[]> {
    return this.db.getAccountSignerSettings()
  }

  async getCurrency(): Promise<FiatCurrency> {
    return (await this.db.getPreferences())?.currency
  }

  async getTokenListPreferences(): Promise<TokenListPreferences> {
    return (await this.db.getPreferences())?.tokenLists
  }

  async getDefaultWallet(): Promise<boolean> {
    return (await this.db.getPreferences())?.defaultWallet
  }

  async setDefaultWalletValue(newDefaultWalletValue: boolean): Promise<void> {
    return this.db.setDefaultWalletValue(newDefaultWalletValue)
  }

  async getSelectedAccount(): Promise<AddressOnNetwork> {
    return (await this.db.getPreferences())?.selectedAccount
  }

  async setSelectedAccount(addressNetwork: AddressOnNetwork): Promise<void> {
    return this.db.setSelectedAccount(addressNetwork)
  }

  async setShowDefaultWalletBanner(newValue: boolean): Promise<void> {
    await this.db.setShowDefaultWalletBanner(newValue)
    await this.emitter.emit("showDefaultWalletBanner", newValue)
  }
}
