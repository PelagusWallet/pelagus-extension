import { FiatCurrency } from "../../assets"
import {
  AccountSignerSettings,
  AccountSignerWithId,
  AddressOnNetwork,
  NameOnNetwork,
} from "../../accounts"
import { ServiceLifecycleEvents, ServiceCreatorFunction } from "../types"
import {
  AnalyticsPreferences,
  Preferences,
  TokenListPreferences,
} from "./types"
import { initializePreferenceDatabase, PreferenceDatabase } from "./db"
import BaseService from "../base"
import { sameNetwork } from "../../networks"
import { HexString } from "../../types"
import { NetworkInterface } from "../../constants/networks/networkTypes"

type AddressBookEntry = {
  network: NetworkInterface
  address: HexString
  name: string
}

type InMemoryAddressBook = AddressBookEntry[]

const sameAddressBookEntry = (a: AddressOnNetwork, b: AddressOnNetwork) =>
  a.address === b.address && sameNetwork(a.network, b.network)

interface Events extends ServiceLifecycleEvents {
  preferencesChanges: Preferences
  initializeDefaultWallet: boolean
  initializeSelectedAccount: AddressOnNetwork
  updateAnalyticsPreferences: AnalyticsPreferences
  addressBookEntryModified: AddressBookEntry
  updatedSignerSettings: AccountSignerSettings[]
  showDefaultWalletBanner: boolean
  showAlphaWalletBanner: boolean
  showTestNetworks: boolean
  showPaymentChannelModal: boolean
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
      const db = await initializePreferenceDatabase()
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
    this.emitter.emit("showTestNetworks", await this.getShowTestNetworks())
    this.emitter.emit(
      "showPaymentChannelModal",
      await this.getShowPaymentChannelModal()
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
        address: newEntry.address,
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

  async getShowPelagusNotificationsValue(): Promise<boolean> {
    return (await this.db.getPreferences())?.showPelagusNotifications
  }

  async setShowPelagusNotificationsValue(
    newShowPelagusNotificationsValue: boolean
  ): Promise<void> {
    return this.db.setShowPelagusNotificationsValue(
      newShowPelagusNotificationsValue
    )
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

  async setShowAlphaWalletBanner(newValue: boolean): Promise<void> {
    await this.db.setShowAlphaWalletBanner(newValue)
    await this.emitter.emit("showAlphaWalletBanner", newValue)
  }

  async getShowTestNetworks(): Promise<boolean> {
    return (await this.db.getPreferences())?.showTestNetworks
  }

  async setShowTestNetworks(isShowTestNetworks: boolean): Promise<void> {
    await this.db.setShowTestNetworks(isShowTestNetworks)
    await this.emitter.emit("showTestNetworks", isShowTestNetworks)
  }

  async getShowPaymentChannelModal(): Promise<boolean> {
    return (await this.db.getPreferences())?.showPaymentChannelModal
  }

  async setShowPaymentChannelModal(
    showPaymentChannelModal: boolean
  ): Promise<void> {
    await this.db.setShowPaymentChannelModal(showPaymentChannelModal)
    await this.emitter.emit("showPaymentChannelModal", showPaymentChannelModal)
  }
}
