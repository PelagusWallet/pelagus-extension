"use strict"

const crypto = require("node:crypto")

function randomId(size = 21, alphabet) {
  const bytes = crypto.randomBytes(size)
  if (alphabet) {
    let value = ""
    for (let index = 0; index < size; index += 1) {
      value += alphabet[bytes[index] % alphabet.length]
    }
    return value
  }
  return bytes.toString("base64url").slice(0, size)
}

function nanoid(size) {
  return randomId(size)
}

function customAlphabet(alphabet, defaultSize = 21) {
  return (size = defaultSize) => randomId(size, alphabet)
}

module.exports = { nanoid, customAlphabet }
