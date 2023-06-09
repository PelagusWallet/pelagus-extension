import { randomUUID } from "crypto"

import { Storage } from "@plasmohq/storage"

import {
  CHAIN_ID_TO_NETWORK,
  NETWORK_TO_CHAIN_ID
} from "~background/services/network/chains"
import { getStorageConfig } from "~utils/storage"

const storage = new Storage(getStorageConfig())

export class WalletContact {
  id: string
  name: string
  networkAddresses: NetworkAddresses[]
}

export class NetworkAddresses {
  chainID: number
  address: string
  network: string
}

export async function getContacts() {
  let contacts: WalletContact[] = await storage.get("contacts")

  return contacts || []
}

export class NetworkAddressLabel {
  network: string
  address: string
}

// Add a contact to the wallet
export async function addContactToWallet(
  name: string,
  addresses: NetworkAddressLabel[]
) {
  if (!name) {
    throw new Error("Contact name is required")
  }

  const contacts = await getContacts()

  let networkAddresses = addresses.map((addressAndNetwork) => {
    const chainID = NETWORK_TO_CHAIN_ID[addressAndNetwork.network]
    return {
      address: addressAndNetwork.address,
      chainID: chainID,
      network: addressAndNetwork.network
    }
  }) as NetworkAddresses[]

  // Remove any addresses that don't have a chainID or address
  networkAddresses = networkAddresses.filter(
    (address) => address.chainID !== undefined && address.address !== null
  )

  // Push contact to contacts array
  contacts.push({
    id: Math.floor(Math.random() * 10000000000000).toString(),
    name: name,
    networkAddresses: networkAddresses
  })

  // Save data
  await storage.set("contacts", contacts)
}

// Add a contact to the wallet
export async function editContactData(
  contact: WalletContact,
  name: string,
  addresses: NetworkAddressLabel[]
) {
  // lookup contact by id
  const contacts = await getContacts()
  let replaceContact = contacts.find(
    (lookupContact) => lookupContact.id === contact.id
  )
  let networkAddresses = addresses.map((addressAndNetwork) => {
    const chainID = NETWORK_TO_CHAIN_ID[addressAndNetwork.network]
    return {
      address: addressAndNetwork.address,
      chainID: chainID,
      network: addressAndNetwork.network
    }
  }) as NetworkAddresses[]
  // Remove any addresses that don't have a chainID or address
  networkAddresses = networkAddresses.filter(
    (address) => address.chainID !== undefined && address.address !== null
  )
  replaceContact.name = name
  replaceContact.networkAddresses = networkAddresses
  // Save data
  await storage.set("contacts", contacts)
}

// Delete contact from storage by name
export async function deleteContactByName(name: string) {
  const contacts = await getContacts()

  const newContacts = contacts.filter((contact) => contact.name !== name)

  await storage.set("contacts", newContacts)
}
