import { isQuaiAddress, Zone } from "quais"

export const isValidZone = (prefix: string): prefix is Zone => {
  return Object.values(Zone).includes(prefix as Zone)
}

/**
 * Validates if a given address is a Golden Age address.
 *
 * This function performs two checks to ensure the address is in the correct format:
 * 1. It uses the `isQuaiAddress` library function to confirm that the 9th bit of address conforms to the Quai address format.
 * 2. It adds a layer of protection by validating the first 4 characters of the address against known shard-specific prefixes.
 *
 * @param {string} addressToValidate - The address to validate.
 * @returns {boolean} True if the address is a valid Golden Age address, false otherwise.
 */
export const isGoldenAgeQuaiAddress = (addressToValidate: string): boolean => {
  if (!isQuaiAddress(addressToValidate)) return false

  const prefix = addressToValidate.slice(0, 4)
  return isValidZone(prefix)
}
