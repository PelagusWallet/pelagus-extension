/**
 * Parses a hexadecimal string representing a timestamp and converts it to a number.
 *
 * @param {string} timestampInHex - The hexadecimal string to be parsed.
 * @param returnInMilliseconds - Optional parameter to specify whether to return the time in milliseconds or seconds. Default is true (milliseconds).
 * @returns {number} - The parsed timestamp in the specified unit (milliseconds or seconds).
 */
export const parseHexTimestamp = (
  timestampInHex: string,
  returnInMilliseconds = true
): number => {
  const timestamp = parseInt(timestampInHex, 16)

  return returnInMilliseconds ? timestamp * 1000 : timestamp
}
