"use strict"
const schema11 = {
  type: "object",
  required: [],
  additionalProperties: {
    type: "object",
    properties: { last_updated_at: { type: "number" } },
    required: ["last_updated_at"],
    additionalProperties: { type: "number", nullable: true },
    nullable: true,
  },
}
function validate10(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {}
) {
  let vErrors = null
  let errors = 0
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      let data0 = data[key0]
      if (
        !(data0 && typeof data0 == "object" && !Array.isArray(data0)) &&
        data0 !== null
      ) {
        const err0 = {
          instancePath:
            instancePath + "/" + key0.replace(/~/g, "~0").replace(/\//g, "~1"),
          schemaPath: "#/additionalProperties/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        }
        if (vErrors === null) {
          vErrors = [err0]
        } else {
          vErrors.push(err0)
        }
        errors++
      }
      if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
        if (data0.last_updated_at === undefined) {
          const err1 = {
            instancePath:
              instancePath +
              "/" +
              key0.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/additionalProperties/required",
            keyword: "required",
            params: { missingProperty: "last_updated_at" },
            message: "must have required property '" + "last_updated_at" + "'",
          }
          if (vErrors === null) {
            vErrors = [err1]
          } else {
            vErrors.push(err1)
          }
          errors++
        }
        for (const key1 in data0) {
          if (!(key1 === "last_updated_at")) {
            let data1 = data0[key1]
            if (
              !(typeof data1 == "number" && isFinite(data1)) &&
              data1 !== null
            ) {
              const err2 = {
                instancePath:
                  instancePath +
                  "/" +
                  key0.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/" +
                  key1.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath: "#/additionalProperties/additionalProperties/type",
                keyword: "type",
                params: { type: "number" },
                message: "must be number",
              }
              if (vErrors === null) {
                vErrors = [err2]
              } else {
                vErrors.push(err2)
              }
              errors++
            }
          }
        }
        if (data0.last_updated_at !== undefined) {
          let data2 = data0.last_updated_at
          if (!(typeof data2 == "number" && isFinite(data2))) {
            const err3 = {
              instancePath:
                instancePath +
                "/" +
                key0.replace(/~/g, "~0").replace(/\//g, "~1") +
                "/last_updated_at",
              schemaPath:
                "#/additionalProperties/properties/last_updated_at/type",
              keyword: "type",
              params: { type: "number" },
              message: "must be number",
            }
            if (vErrors === null) {
              vErrors = [err3]
            } else {
              vErrors.push(err3)
            }
            errors++
          }
        }
      }
    }
  } else {
    const err4 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    }
    if (vErrors === null) {
      vErrors = [err4]
    } else {
      vErrors.push(err4)
    }
    errors++
  }
  validate10.errors = vErrors
  return errors === 0
}
exports.isValidUniswapTokenListResponse = validate11
const schema12 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://uniswap.org/tokenlist.schema.json",
  title: "Uniswap Token List",
  description:
    "Schema for lists of tokens compatible with the Uniswap Interface",
  definitions: {
    Version: {
      type: "object",
      description: "The version of the list, used in change detection",
      examples: [{ major: 1, minor: 0, patch: 0 }],
      additionalProperties: false,
      properties: {
        major: {
          type: "integer",
          description:
            "The major version of the list. Must be incremented when tokens are removed from the list or token addresses are changed.",
          minimum: 0,
          examples: [1, 2],
        },
        minor: {
          type: "integer",
          description:
            "The minor version of the list. Must be incremented when tokens are added to the list.",
          minimum: 0,
          examples: [0, 1],
        },
        patch: {
          type: "integer",
          description:
            "The patch version of the list. Must be incremented for any changes to the list.",
          minimum: 0,
          examples: [0, 1],
        },
      },
      required: ["major", "minor", "patch"],
    },
    TagIdentifier: {
      type: "string",
      description: "The unique identifier of a tag",
      minLength: 1,
      maxLength: 10,
      pattern: "^[\\w]+$",
      examples: ["compound", "stablecoin"],
    },
    ExtensionIdentifier: {
      type: "string",
      description: "The name of a token extension property",
      minLength: 1,
      maxLength: 40,
      pattern: "^[\\w]+$",
      examples: ["color", "is_fee_on_transfer", "aliases"],
    },
    ExtensionMap: {
      type: "object",
      description:
        "An object containing any arbitrary or vendor-specific token metadata",
      maxProperties: 10,
      propertyNames: { $ref: "#/definitions/ExtensionIdentifier" },
      additionalProperties: { $ref: "#/definitions/ExtensionValue" },
      examples: [
        { color: "#000000", is_verified_by_me: true },
        {
          "x-bridged-addresses-by-chain": {
            1: {
              bridgeAddress: "0x4200000000000000000000000000000000000010",
              tokenAddress: "0x4200000000000000000000000000000000000010",
            },
          },
        },
      ],
    },
    ExtensionPrimitiveValue: {
      anyOf: [
        { type: "string", minLength: 1, maxLength: 42, examples: ["#00000"] },
        { type: "boolean", examples: [true] },
        { type: "number", examples: [15] },
        { type: "null" },
      ],
    },
    ExtensionValue: {
      anyOf: [
        { $ref: "#/definitions/ExtensionPrimitiveValue" },
        {
          type: "object",
          maxProperties: 10,
          propertyNames: { $ref: "#/definitions/ExtensionIdentifier" },
          additionalProperties: { $ref: "#/definitions/ExtensionValueInner0" },
        },
      ],
    },
    ExtensionValueInner0: {
      anyOf: [
        { $ref: "#/definitions/ExtensionPrimitiveValue" },
        {
          type: "object",
          maxProperties: 10,
          propertyNames: { $ref: "#/definitions/ExtensionIdentifier" },
          additionalProperties: { $ref: "#/definitions/ExtensionValueInner1" },
        },
      ],
    },
    ExtensionValueInner1: {
      anyOf: [{ $ref: "#/definitions/ExtensionPrimitiveValue" }],
    },
    TagDefinition: {
      type: "object",
      description:
        "Definition of a tag that can be associated with a token via its identifier",
      additionalProperties: false,
      properties: {
        name: {
          type: "string",
          description: "The name of the tag",
          pattern: "^[ \\w]+$",
          minLength: 1,
          maxLength: 20,
        },
        description: {
          type: "string",
          description: "A user-friendly description of the tag",
          pattern: "^[ \\w\\.,:]+$",
          minLength: 1,
          maxLength: 200,
        },
      },
      required: ["name", "description"],
      examples: [
        {
          name: "Stablecoin",
          description: "A token with value pegged to another asset",
        },
      ],
    },
    TokenInfo: {
      type: "object",
      description: "Metadata for a single token in a token list",
      additionalProperties: false,
      properties: {
        chainId: {
          type: "integer",
          description:
            "The chain ID of the Ethereum network where this token is deployed",
          minimum: 1,
          examples: [1, 42],
        },
        address: {
          type: "string",
          description:
            "The checksummed address of the token on the specified chain ID",
          pattern: "^0x[a-fA-F0-9]{40}$",
          examples: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
        },
        decimals: {
          type: "integer",
          description: "The number of decimals for the token balance",
          minimum: 0,
          maximum: 255,
          examples: [18],
        },
        name: {
          type: "string",
          description: "The name of the token",
          minLength: 1,
          maxLength: 40,
          pattern: "^[ \\w.'+\\-%/À-ÖØ-öø-ÿ:&\\[\\]\\(\\)]+$",
          examples: ["USD Coin"],
        },
        symbol: {
          type: "string",
          description: "The symbol for the token; must be alphanumeric",
          pattern: "^[a-zA-Z0-9+\\-%/$.]+$",
          minLength: 1,
          maxLength: 20,
          examples: ["USDC"],
        },
        logoURI: {
          type: "string",
          description:
            "A URI to the token logo asset; if not set, interface will attempt to find a logo based on the token address; suggest SVG or PNG of size 64x64",
          format: "uri",
          examples: ["ipfs://QmXfzKRvjZz3u5JRgC4v5mGVbm9ahrUiB4DgzHBsnWbTMM"],
        },
        tags: {
          type: "array",
          description:
            "An array of tag identifiers associated with the token; tags are defined at the list level",
          items: { $ref: "#/definitions/TagIdentifier" },
          maxItems: 10,
          examples: ["stablecoin", "compound"],
        },
        extensions: { $ref: "#/definitions/ExtensionMap" },
      },
      required: ["chainId", "address", "decimals", "name", "symbol"],
    },
  },
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      description: "The name of the token list",
      minLength: 1,
      maxLength: 30,
      pattern: "^[\\w ]+$",
      examples: ["My Token List"],
    },
    timestamp: {
      type: "string",
      format: "date-time",
      description:
        "The timestamp of this list version; i.e. when this immutable version of the list was created",
    },
    version: { $ref: "#/definitions/Version" },
    tokens: {
      type: "array",
      description: "The list of tokens included in the list",
      items: { $ref: "#/definitions/TokenInfo" },
      minItems: 1,
      maxItems: 10000,
    },
    keywords: {
      type: "array",
      description:
        "Keywords associated with the contents of the list; may be used in list discoverability",
      items: {
        type: "string",
        description: "A keyword to describe the contents of the list",
        minLength: 1,
        maxLength: 20,
        pattern: "^[\\w ]+$",
        examples: ["compound", "lending", "personal tokens"],
      },
      maxItems: 20,
      uniqueItems: true,
    },
    tags: {
      type: "object",
      description: "A mapping of tag identifiers to their name and description",
      propertyNames: { $ref: "#/definitions/TagIdentifier" },
      additionalProperties: { $ref: "#/definitions/TagDefinition" },
      maxProperties: 20,
      examples: [
        {
          stablecoin: {
            name: "Stablecoin",
            description: "A token with value pegged to another asset",
          },
        },
      ],
    },
    logoURI: {
      type: "string",
      description:
        "A URI for the logo of the token list; prefer SVG or PNG of size 256x256",
      format: "uri",
      examples: ["ipfs://QmXfzKRvjZz3u5JRgC4v5mGVbm9ahrUiB4DgzHBsnWbTMM"],
    },
  },
  required: ["name", "timestamp", "version", "tokens"],
}
const schema13 = {
  type: "object",
  description: "The version of the list, used in change detection",
  examples: [{ major: 1, minor: 0, patch: 0 }],
  additionalProperties: false,
  properties: {
    major: {
      type: "integer",
      description:
        "The major version of the list. Must be incremented when tokens are removed from the list or token addresses are changed.",
      minimum: 0,
      examples: [1, 2],
    },
    minor: {
      type: "integer",
      description:
        "The minor version of the list. Must be incremented when tokens are added to the list.",
      minimum: 0,
      examples: [0, 1],
    },
    patch: {
      type: "integer",
      description:
        "The patch version of the list. Must be incremented for any changes to the list.",
      minimum: 0,
      examples: [0, 1],
    },
  },
  required: ["major", "minor", "patch"],
}
const schema15 = {
  type: "string",
  description: "The unique identifier of a tag",
  minLength: 1,
  maxLength: 10,
  pattern: "^[\\w]+$",
  examples: ["compound", "stablecoin"],
}
const schema27 = {
  type: "object",
  description:
    "Definition of a tag that can be associated with a token via its identifier",
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      description: "The name of the tag",
      pattern: "^[ \\w]+$",
      minLength: 1,
      maxLength: 20,
    },
    description: {
      type: "string",
      description: "A user-friendly description of the tag",
      pattern: "^[ \\w\\.,:]+$",
      minLength: 1,
      maxLength: 200,
    },
  },
  required: ["name", "description"],
  examples: [
    {
      name: "Stablecoin",
      description: "A token with value pegged to another asset",
    },
  ],
}
const func4 = require("ajv/dist/runtime/ucs2length").default
const pattern0 = new RegExp("^[\\w ]+$", "u")
const pattern4 = new RegExp("^[\\w]+$", "u")
const pattern10 = new RegExp("^[ \\w]+$", "u")
const pattern11 = new RegExp("^[ \\w\\.,:]+$", "u")
const schema14 = {
  type: "object",
  description: "Metadata for a single token in a token list",
  additionalProperties: false,
  properties: {
    chainId: {
      type: "integer",
      description:
        "The chain ID of the Ethereum network where this token is deployed",
      minimum: 1,
      examples: [1, 42],
    },
    address: {
      type: "string",
      description:
        "The checksummed address of the token on the specified chain ID",
      pattern: "^0x[a-fA-F0-9]{40}$",
      examples: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
    },
    decimals: {
      type: "integer",
      description: "The number of decimals for the token balance",
      minimum: 0,
      maximum: 255,
      examples: [18],
    },
    name: {
      type: "string",
      description: "The name of the token",
      minLength: 1,
      maxLength: 40,
      pattern: "^[ \\w.'+\\-%/À-ÖØ-öø-ÿ:&\\[\\]\\(\\)]+$",
      examples: ["USD Coin"],
    },
    symbol: {
      type: "string",
      description: "The symbol for the token; must be alphanumeric",
      pattern: "^[a-zA-Z0-9+\\-%/$.]+$",
      minLength: 1,
      maxLength: 20,
      examples: ["USDC"],
    },
    logoURI: {
      type: "string",
      description:
        "A URI to the token logo asset; if not set, interface will attempt to find a logo based on the token address; suggest SVG or PNG of size 64x64",
      format: "uri",
      examples: ["ipfs://QmXfzKRvjZz3u5JRgC4v5mGVbm9ahrUiB4DgzHBsnWbTMM"],
    },
    tags: {
      type: "array",
      description:
        "An array of tag identifiers associated with the token; tags are defined at the list level",
      items: { $ref: "#/definitions/TagIdentifier" },
      maxItems: 10,
      examples: ["stablecoin", "compound"],
    },
    extensions: { $ref: "#/definitions/ExtensionMap" },
  },
  required: ["chainId", "address", "decimals", "name", "symbol"],
}
const pattern1 = new RegExp("^0x[a-fA-F0-9]{40}$", "u")
const pattern2 = new RegExp("^[ \\w.'+\\-%/À-ÖØ-öø-ÿ:&\\[\\]\\(\\)]+$", "u")
const pattern3 = new RegExp("^[a-zA-Z0-9+\\-%/$.]+$", "u")
const schema16 = {
  type: "object",
  description:
    "An object containing any arbitrary or vendor-specific token metadata",
  maxProperties: 10,
  propertyNames: { $ref: "#/definitions/ExtensionIdentifier" },
  additionalProperties: { $ref: "#/definitions/ExtensionValue" },
  examples: [
    { color: "#000000", is_verified_by_me: true },
    {
      "x-bridged-addresses-by-chain": {
        1: {
          bridgeAddress: "0x4200000000000000000000000000000000000010",
          tokenAddress: "0x4200000000000000000000000000000000000010",
        },
      },
    },
  ],
}
const schema17 = {
  type: "string",
  description: "The name of a token extension property",
  minLength: 1,
  maxLength: 40,
  pattern: "^[\\w]+$",
  examples: ["color", "is_fee_on_transfer", "aliases"],
}
const schema18 = {
  anyOf: [
    { $ref: "#/definitions/ExtensionPrimitiveValue" },
    {
      type: "object",
      maxProperties: 10,
      propertyNames: { $ref: "#/definitions/ExtensionIdentifier" },
      additionalProperties: { $ref: "#/definitions/ExtensionValueInner0" },
    },
  ],
}
const schema19 = {
  anyOf: [
    { type: "string", minLength: 1, maxLength: 42, examples: ["#00000"] },
    { type: "boolean", examples: [true] },
    { type: "number", examples: [15] },
    { type: "null" },
  ],
}
const schema21 = {
  anyOf: [
    { $ref: "#/definitions/ExtensionPrimitiveValue" },
    {
      type: "object",
      maxProperties: 10,
      propertyNames: { $ref: "#/definitions/ExtensionIdentifier" },
      additionalProperties: { $ref: "#/definitions/ExtensionValueInner1" },
    },
  ],
}
const schema24 = { anyOf: [{ $ref: "#/definitions/ExtensionPrimitiveValue" }] }
function validate16(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {}
) {
  let vErrors = null
  let errors = 0
  const _errs0 = errors
  let valid0 = false
  const _errs1 = errors
  const _errs3 = errors
  let valid2 = false
  const _errs4 = errors
  if (typeof data === "string") {
    if (func4(data) > 42) {
      const err0 = {
        instancePath,
        schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/0/maxLength",
        keyword: "maxLength",
        params: { limit: 42 },
        message: "must NOT have more than 42 characters",
      }
      if (vErrors === null) {
        vErrors = [err0]
      } else {
        vErrors.push(err0)
      }
      errors++
    }
    if (func4(data) < 1) {
      const err1 = {
        instancePath,
        schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/0/minLength",
        keyword: "minLength",
        params: { limit: 1 },
        message: "must NOT have fewer than 1 characters",
      }
      if (vErrors === null) {
        vErrors = [err1]
      } else {
        vErrors.push(err1)
      }
      errors++
    }
  } else {
    const err2 = {
      instancePath,
      schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/0/type",
      keyword: "type",
      params: { type: "string" },
      message: "must be string",
    }
    if (vErrors === null) {
      vErrors = [err2]
    } else {
      vErrors.push(err2)
    }
    errors++
  }
  var _valid1 = _errs4 === errors
  valid2 = valid2 || _valid1
  if (!valid2) {
    const _errs6 = errors
    if (typeof data !== "boolean") {
      const err3 = {
        instancePath,
        schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/1/type",
        keyword: "type",
        params: { type: "boolean" },
        message: "must be boolean",
      }
      if (vErrors === null) {
        vErrors = [err3]
      } else {
        vErrors.push(err3)
      }
      errors++
    }
    var _valid1 = _errs6 === errors
    valid2 = valid2 || _valid1
    if (!valid2) {
      const _errs8 = errors
      if (!(typeof data == "number" && isFinite(data))) {
        const err4 = {
          instancePath,
          schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/2/type",
          keyword: "type",
          params: { type: "number" },
          message: "must be number",
        }
        if (vErrors === null) {
          vErrors = [err4]
        } else {
          vErrors.push(err4)
        }
        errors++
      }
      var _valid1 = _errs8 === errors
      valid2 = valid2 || _valid1
      if (!valid2) {
        const _errs10 = errors
        if (data !== null) {
          const err5 = {
            instancePath,
            schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/3/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          }
          if (vErrors === null) {
            vErrors = [err5]
          } else {
            vErrors.push(err5)
          }
          errors++
        }
        var _valid1 = _errs10 === errors
        valid2 = valid2 || _valid1
      }
    }
  }
  if (!valid2) {
    const err6 = {
      instancePath,
      schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf",
      keyword: "anyOf",
      params: {},
      message: "must match a schema in anyOf",
    }
    if (vErrors === null) {
      vErrors = [err6]
    } else {
      vErrors.push(err6)
    }
    errors++
  } else {
    errors = _errs3
    if (vErrors !== null) {
      if (_errs3) {
        vErrors.length = _errs3
      } else {
        vErrors = null
      }
    }
  }
  var _valid0 = _errs1 === errors
  valid0 = valid0 || _valid0
  if (!valid0) {
    const err7 = {
      instancePath,
      schemaPath: "#/anyOf",
      keyword: "anyOf",
      params: {},
      message: "must match a schema in anyOf",
    }
    if (vErrors === null) {
      vErrors = [err7]
    } else {
      vErrors.push(err7)
    }
    errors++
  } else {
    errors = _errs0
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0
      } else {
        vErrors = null
      }
    }
  }
  validate16.errors = vErrors
  return errors === 0
}
function validate15(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {}
) {
  let vErrors = null
  let errors = 0
  const _errs0 = errors
  let valid0 = false
  const _errs1 = errors
  const _errs3 = errors
  let valid2 = false
  const _errs4 = errors
  if (typeof data === "string") {
    if (func4(data) > 42) {
      const err0 = {
        instancePath,
        schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/0/maxLength",
        keyword: "maxLength",
        params: { limit: 42 },
        message: "must NOT have more than 42 characters",
      }
      if (vErrors === null) {
        vErrors = [err0]
      } else {
        vErrors.push(err0)
      }
      errors++
    }
    if (func4(data) < 1) {
      const err1 = {
        instancePath,
        schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/0/minLength",
        keyword: "minLength",
        params: { limit: 1 },
        message: "must NOT have fewer than 1 characters",
      }
      if (vErrors === null) {
        vErrors = [err1]
      } else {
        vErrors.push(err1)
      }
      errors++
    }
  } else {
    const err2 = {
      instancePath,
      schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/0/type",
      keyword: "type",
      params: { type: "string" },
      message: "must be string",
    }
    if (vErrors === null) {
      vErrors = [err2]
    } else {
      vErrors.push(err2)
    }
    errors++
  }
  var _valid1 = _errs4 === errors
  valid2 = valid2 || _valid1
  if (!valid2) {
    const _errs6 = errors
    if (typeof data !== "boolean") {
      const err3 = {
        instancePath,
        schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/1/type",
        keyword: "type",
        params: { type: "boolean" },
        message: "must be boolean",
      }
      if (vErrors === null) {
        vErrors = [err3]
      } else {
        vErrors.push(err3)
      }
      errors++
    }
    var _valid1 = _errs6 === errors
    valid2 = valid2 || _valid1
    if (!valid2) {
      const _errs8 = errors
      if (!(typeof data == "number" && isFinite(data))) {
        const err4 = {
          instancePath,
          schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/2/type",
          keyword: "type",
          params: { type: "number" },
          message: "must be number",
        }
        if (vErrors === null) {
          vErrors = [err4]
        } else {
          vErrors.push(err4)
        }
        errors++
      }
      var _valid1 = _errs8 === errors
      valid2 = valid2 || _valid1
      if (!valid2) {
        const _errs10 = errors
        if (data !== null) {
          const err5 = {
            instancePath,
            schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/3/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          }
          if (vErrors === null) {
            vErrors = [err5]
          } else {
            vErrors.push(err5)
          }
          errors++
        }
        var _valid1 = _errs10 === errors
        valid2 = valid2 || _valid1
      }
    }
  }
  if (!valid2) {
    const err6 = {
      instancePath,
      schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf",
      keyword: "anyOf",
      params: {},
      message: "must match a schema in anyOf",
    }
    if (vErrors === null) {
      vErrors = [err6]
    } else {
      vErrors.push(err6)
    }
    errors++
  } else {
    errors = _errs3
    if (vErrors !== null) {
      if (_errs3) {
        vErrors.length = _errs3
      } else {
        vErrors = null
      }
    }
  }
  var _valid0 = _errs1 === errors
  valid0 = valid0 || _valid0
  if (!valid0) {
    const _errs12 = errors
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (Object.keys(data).length > 10) {
        const err7 = {
          instancePath,
          schemaPath: "#/anyOf/1/maxProperties",
          keyword: "maxProperties",
          params: { limit: 10 },
          message: "must NOT have more than 10 items",
        }
        if (vErrors === null) {
          vErrors = [err7]
        } else {
          vErrors.push(err7)
        }
        errors++
      }
      for (const key0 in data) {
        const _errs14 = errors
        if (typeof key0 === "string") {
          if (func4(key0) > 40) {
            const err8 = {
              instancePath,
              schemaPath: "#/definitions/ExtensionIdentifier/maxLength",
              keyword: "maxLength",
              params: { limit: 40 },
              message: "must NOT have more than 40 characters",
              propertyName: key0,
            }
            if (vErrors === null) {
              vErrors = [err8]
            } else {
              vErrors.push(err8)
            }
            errors++
          }
          if (func4(key0) < 1) {
            const err9 = {
              instancePath,
              schemaPath: "#/definitions/ExtensionIdentifier/minLength",
              keyword: "minLength",
              params: { limit: 1 },
              message: "must NOT have fewer than 1 characters",
              propertyName: key0,
            }
            if (vErrors === null) {
              vErrors = [err9]
            } else {
              vErrors.push(err9)
            }
            errors++
          }
          if (!pattern4.test(key0)) {
            const err10 = {
              instancePath,
              schemaPath: "#/definitions/ExtensionIdentifier/pattern",
              keyword: "pattern",
              params: { pattern: "^[\\w]+$" },
              message: 'must match pattern "' + "^[\\w]+$" + '"',
              propertyName: key0,
            }
            if (vErrors === null) {
              vErrors = [err10]
            } else {
              vErrors.push(err10)
            }
            errors++
          }
        } else {
          const err11 = {
            instancePath,
            schemaPath: "#/definitions/ExtensionIdentifier/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
            propertyName: key0,
          }
          if (vErrors === null) {
            vErrors = [err11]
          } else {
            vErrors.push(err11)
          }
          errors++
        }
        var valid3 = _errs14 === errors
        if (!valid3) {
          const err12 = {
            instancePath,
            schemaPath: "#/anyOf/1/propertyNames",
            keyword: "propertyNames",
            params: { propertyName: key0 },
            message: "property name must be valid",
          }
          if (vErrors === null) {
            vErrors = [err12]
          } else {
            vErrors.push(err12)
          }
          errors++
        }
      }
      for (const key1 in data) {
        if (
          !validate16(data[key1], {
            instancePath:
              instancePath +
              "/" +
              key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            parentData: data,
            parentDataProperty: key1,
            rootData,
          })
        ) {
          vErrors =
            vErrors === null
              ? validate16.errors
              : vErrors.concat(validate16.errors)
          errors = vErrors.length
        }
      }
    } else {
      const err13 = {
        instancePath,
        schemaPath: "#/anyOf/1/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      }
      if (vErrors === null) {
        vErrors = [err13]
      } else {
        vErrors.push(err13)
      }
      errors++
    }
    var _valid0 = _errs12 === errors
    valid0 = valid0 || _valid0
  }
  if (!valid0) {
    const err14 = {
      instancePath,
      schemaPath: "#/anyOf",
      keyword: "anyOf",
      params: {},
      message: "must match a schema in anyOf",
    }
    if (vErrors === null) {
      vErrors = [err14]
    } else {
      vErrors.push(err14)
    }
    errors++
  } else {
    errors = _errs0
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0
      } else {
        vErrors = null
      }
    }
  }
  validate15.errors = vErrors
  return errors === 0
}
function validate14(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {}
) {
  let vErrors = null
  let errors = 0
  const _errs0 = errors
  let valid0 = false
  const _errs1 = errors
  const _errs3 = errors
  let valid2 = false
  const _errs4 = errors
  if (typeof data === "string") {
    if (func4(data) > 42) {
      const err0 = {
        instancePath,
        schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/0/maxLength",
        keyword: "maxLength",
        params: { limit: 42 },
        message: "must NOT have more than 42 characters",
      }
      if (vErrors === null) {
        vErrors = [err0]
      } else {
        vErrors.push(err0)
      }
      errors++
    }
    if (func4(data) < 1) {
      const err1 = {
        instancePath,
        schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/0/minLength",
        keyword: "minLength",
        params: { limit: 1 },
        message: "must NOT have fewer than 1 characters",
      }
      if (vErrors === null) {
        vErrors = [err1]
      } else {
        vErrors.push(err1)
      }
      errors++
    }
  } else {
    const err2 = {
      instancePath,
      schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/0/type",
      keyword: "type",
      params: { type: "string" },
      message: "must be string",
    }
    if (vErrors === null) {
      vErrors = [err2]
    } else {
      vErrors.push(err2)
    }
    errors++
  }
  var _valid1 = _errs4 === errors
  valid2 = valid2 || _valid1
  if (!valid2) {
    const _errs6 = errors
    if (typeof data !== "boolean") {
      const err3 = {
        instancePath,
        schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/1/type",
        keyword: "type",
        params: { type: "boolean" },
        message: "must be boolean",
      }
      if (vErrors === null) {
        vErrors = [err3]
      } else {
        vErrors.push(err3)
      }
      errors++
    }
    var _valid1 = _errs6 === errors
    valid2 = valid2 || _valid1
    if (!valid2) {
      const _errs8 = errors
      if (!(typeof data == "number" && isFinite(data))) {
        const err4 = {
          instancePath,
          schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/2/type",
          keyword: "type",
          params: { type: "number" },
          message: "must be number",
        }
        if (vErrors === null) {
          vErrors = [err4]
        } else {
          vErrors.push(err4)
        }
        errors++
      }
      var _valid1 = _errs8 === errors
      valid2 = valid2 || _valid1
      if (!valid2) {
        const _errs10 = errors
        if (data !== null) {
          const err5 = {
            instancePath,
            schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf/3/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          }
          if (vErrors === null) {
            vErrors = [err5]
          } else {
            vErrors.push(err5)
          }
          errors++
        }
        var _valid1 = _errs10 === errors
        valid2 = valid2 || _valid1
      }
    }
  }
  if (!valid2) {
    const err6 = {
      instancePath,
      schemaPath: "#/definitions/ExtensionPrimitiveValue/anyOf",
      keyword: "anyOf",
      params: {},
      message: "must match a schema in anyOf",
    }
    if (vErrors === null) {
      vErrors = [err6]
    } else {
      vErrors.push(err6)
    }
    errors++
  } else {
    errors = _errs3
    if (vErrors !== null) {
      if (_errs3) {
        vErrors.length = _errs3
      } else {
        vErrors = null
      }
    }
  }
  var _valid0 = _errs1 === errors
  valid0 = valid0 || _valid0
  if (!valid0) {
    const _errs12 = errors
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (Object.keys(data).length > 10) {
        const err7 = {
          instancePath,
          schemaPath: "#/anyOf/1/maxProperties",
          keyword: "maxProperties",
          params: { limit: 10 },
          message: "must NOT have more than 10 items",
        }
        if (vErrors === null) {
          vErrors = [err7]
        } else {
          vErrors.push(err7)
        }
        errors++
      }
      for (const key0 in data) {
        const _errs14 = errors
        if (typeof key0 === "string") {
          if (func4(key0) > 40) {
            const err8 = {
              instancePath,
              schemaPath: "#/definitions/ExtensionIdentifier/maxLength",
              keyword: "maxLength",
              params: { limit: 40 },
              message: "must NOT have more than 40 characters",
              propertyName: key0,
            }
            if (vErrors === null) {
              vErrors = [err8]
            } else {
              vErrors.push(err8)
            }
            errors++
          }
          if (func4(key0) < 1) {
            const err9 = {
              instancePath,
              schemaPath: "#/definitions/ExtensionIdentifier/minLength",
              keyword: "minLength",
              params: { limit: 1 },
              message: "must NOT have fewer than 1 characters",
              propertyName: key0,
            }
            if (vErrors === null) {
              vErrors = [err9]
            } else {
              vErrors.push(err9)
            }
            errors++
          }
          if (!pattern4.test(key0)) {
            const err10 = {
              instancePath,
              schemaPath: "#/definitions/ExtensionIdentifier/pattern",
              keyword: "pattern",
              params: { pattern: "^[\\w]+$" },
              message: 'must match pattern "' + "^[\\w]+$" + '"',
              propertyName: key0,
            }
            if (vErrors === null) {
              vErrors = [err10]
            } else {
              vErrors.push(err10)
            }
            errors++
          }
        } else {
          const err11 = {
            instancePath,
            schemaPath: "#/definitions/ExtensionIdentifier/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
            propertyName: key0,
          }
          if (vErrors === null) {
            vErrors = [err11]
          } else {
            vErrors.push(err11)
          }
          errors++
        }
        var valid3 = _errs14 === errors
        if (!valid3) {
          const err12 = {
            instancePath,
            schemaPath: "#/anyOf/1/propertyNames",
            keyword: "propertyNames",
            params: { propertyName: key0 },
            message: "property name must be valid",
          }
          if (vErrors === null) {
            vErrors = [err12]
          } else {
            vErrors.push(err12)
          }
          errors++
        }
      }
      for (const key1 in data) {
        if (
          !validate15(data[key1], {
            instancePath:
              instancePath +
              "/" +
              key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            parentData: data,
            parentDataProperty: key1,
            rootData,
          })
        ) {
          vErrors =
            vErrors === null
              ? validate15.errors
              : vErrors.concat(validate15.errors)
          errors = vErrors.length
        }
      }
    } else {
      const err13 = {
        instancePath,
        schemaPath: "#/anyOf/1/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      }
      if (vErrors === null) {
        vErrors = [err13]
      } else {
        vErrors.push(err13)
      }
      errors++
    }
    var _valid0 = _errs12 === errors
    valid0 = valid0 || _valid0
  }
  if (!valid0) {
    const err14 = {
      instancePath,
      schemaPath: "#/anyOf",
      keyword: "anyOf",
      params: {},
      message: "must match a schema in anyOf",
    }
    if (vErrors === null) {
      vErrors = [err14]
    } else {
      vErrors.push(err14)
    }
    errors++
  } else {
    errors = _errs0
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0
      } else {
        vErrors = null
      }
    }
  }
  validate14.errors = vErrors
  return errors === 0
}
function validate13(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {}
) {
  let vErrors = null
  let errors = 0
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (Object.keys(data).length > 10) {
      const err0 = {
        instancePath,
        schemaPath: "#/maxProperties",
        keyword: "maxProperties",
        params: { limit: 10 },
        message: "must NOT have more than 10 items",
      }
      if (vErrors === null) {
        vErrors = [err0]
      } else {
        vErrors.push(err0)
      }
      errors++
    }
    for (const key0 in data) {
      const _errs1 = errors
      if (typeof key0 === "string") {
        if (func4(key0) > 40) {
          const err1 = {
            instancePath,
            schemaPath: "#/definitions/ExtensionIdentifier/maxLength",
            keyword: "maxLength",
            params: { limit: 40 },
            message: "must NOT have more than 40 characters",
            propertyName: key0,
          }
          if (vErrors === null) {
            vErrors = [err1]
          } else {
            vErrors.push(err1)
          }
          errors++
        }
        if (func4(key0) < 1) {
          const err2 = {
            instancePath,
            schemaPath: "#/definitions/ExtensionIdentifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
            propertyName: key0,
          }
          if (vErrors === null) {
            vErrors = [err2]
          } else {
            vErrors.push(err2)
          }
          errors++
        }
        if (!pattern4.test(key0)) {
          const err3 = {
            instancePath,
            schemaPath: "#/definitions/ExtensionIdentifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[\\w]+$" },
            message: 'must match pattern "' + "^[\\w]+$" + '"',
            propertyName: key0,
          }
          if (vErrors === null) {
            vErrors = [err3]
          } else {
            vErrors.push(err3)
          }
          errors++
        }
      } else {
        const err4 = {
          instancePath,
          schemaPath: "#/definitions/ExtensionIdentifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
          propertyName: key0,
        }
        if (vErrors === null) {
          vErrors = [err4]
        } else {
          vErrors.push(err4)
        }
        errors++
      }
      var valid0 = _errs1 === errors
      if (!valid0) {
        const err5 = {
          instancePath,
          schemaPath: "#/propertyNames",
          keyword: "propertyNames",
          params: { propertyName: key0 },
          message: "property name must be valid",
        }
        if (vErrors === null) {
          vErrors = [err5]
        } else {
          vErrors.push(err5)
        }
        errors++
      }
    }
    for (const key1 in data) {
      if (
        !validate14(data[key1], {
          instancePath:
            instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
          parentData: data,
          parentDataProperty: key1,
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate14.errors
            : vErrors.concat(validate14.errors)
        errors = vErrors.length
      }
    }
  } else {
    const err6 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    }
    if (vErrors === null) {
      vErrors = [err6]
    } else {
      vErrors.push(err6)
    }
    errors++
  }
  validate13.errors = vErrors
  return errors === 0
}
function validate12(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {}
) {
  let vErrors = null
  let errors = 0
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.chainId === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "chainId" },
        message: "must have required property '" + "chainId" + "'",
      }
      if (vErrors === null) {
        vErrors = [err0]
      } else {
        vErrors.push(err0)
      }
      errors++
    }
    if (data.address === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "address" },
        message: "must have required property '" + "address" + "'",
      }
      if (vErrors === null) {
        vErrors = [err1]
      } else {
        vErrors.push(err1)
      }
      errors++
    }
    if (data.decimals === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "decimals" },
        message: "must have required property '" + "decimals" + "'",
      }
      if (vErrors === null) {
        vErrors = [err2]
      } else {
        vErrors.push(err2)
      }
      errors++
    }
    if (data.name === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "name" },
        message: "must have required property '" + "name" + "'",
      }
      if (vErrors === null) {
        vErrors = [err3]
      } else {
        vErrors.push(err3)
      }
      errors++
    }
    if (data.symbol === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "symbol" },
        message: "must have required property '" + "symbol" + "'",
      }
      if (vErrors === null) {
        vErrors = [err4]
      } else {
        vErrors.push(err4)
      }
      errors++
    }
    for (const key0 in data) {
      if (
        !(
          key0 === "chainId" ||
          key0 === "address" ||
          key0 === "decimals" ||
          key0 === "name" ||
          key0 === "symbol" ||
          key0 === "logoURI" ||
          key0 === "tags" ||
          key0 === "extensions"
        )
      ) {
        const err5 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        }
        if (vErrors === null) {
          vErrors = [err5]
        } else {
          vErrors.push(err5)
        }
        errors++
      }
    }
    if (data.chainId !== undefined) {
      let data0 = data.chainId
      if (
        !(
          typeof data0 == "number" &&
          !(data0 % 1) &&
          !isNaN(data0) &&
          isFinite(data0)
        )
      ) {
        const err6 = {
          instancePath: instancePath + "/chainId",
          schemaPath: "#/properties/chainId/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        }
        if (vErrors === null) {
          vErrors = [err6]
        } else {
          vErrors.push(err6)
        }
        errors++
      }
      if (typeof data0 == "number" && isFinite(data0)) {
        if (data0 < 1 || isNaN(data0)) {
          const err7 = {
            instancePath: instancePath + "/chainId",
            schemaPath: "#/properties/chainId/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 1 },
            message: "must be >= 1",
          }
          if (vErrors === null) {
            vErrors = [err7]
          } else {
            vErrors.push(err7)
          }
          errors++
        }
      }
    }
    if (data.address !== undefined) {
      let data1 = data.address
      if (typeof data1 === "string") {
        if (!pattern1.test(data1)) {
          const err8 = {
            instancePath: instancePath + "/address",
            schemaPath: "#/properties/address/pattern",
            keyword: "pattern",
            params: { pattern: "^0x[a-fA-F0-9]{40}$" },
            message: 'must match pattern "' + "^0x[a-fA-F0-9]{40}$" + '"',
          }
          if (vErrors === null) {
            vErrors = [err8]
          } else {
            vErrors.push(err8)
          }
          errors++
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/address",
          schemaPath: "#/properties/address/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err9]
        } else {
          vErrors.push(err9)
        }
        errors++
      }
    }
    if (data.decimals !== undefined) {
      let data2 = data.decimals
      if (
        !(
          typeof data2 == "number" &&
          !(data2 % 1) &&
          !isNaN(data2) &&
          isFinite(data2)
        )
      ) {
        const err10 = {
          instancePath: instancePath + "/decimals",
          schemaPath: "#/properties/decimals/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        }
        if (vErrors === null) {
          vErrors = [err10]
        } else {
          vErrors.push(err10)
        }
        errors++
      }
      if (typeof data2 == "number" && isFinite(data2)) {
        if (data2 > 255 || isNaN(data2)) {
          const err11 = {
            instancePath: instancePath + "/decimals",
            schemaPath: "#/properties/decimals/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 255 },
            message: "must be <= 255",
          }
          if (vErrors === null) {
            vErrors = [err11]
          } else {
            vErrors.push(err11)
          }
          errors++
        }
        if (data2 < 0 || isNaN(data2)) {
          const err12 = {
            instancePath: instancePath + "/decimals",
            schemaPath: "#/properties/decimals/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          }
          if (vErrors === null) {
            vErrors = [err12]
          } else {
            vErrors.push(err12)
          }
          errors++
        }
      }
    }
    if (data.name !== undefined) {
      let data3 = data.name
      if (typeof data3 === "string") {
        if (func4(data3) > 40) {
          const err13 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/maxLength",
            keyword: "maxLength",
            params: { limit: 40 },
            message: "must NOT have more than 40 characters",
          }
          if (vErrors === null) {
            vErrors = [err13]
          } else {
            vErrors.push(err13)
          }
          errors++
        }
        if (func4(data3) < 1) {
          const err14 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          }
          if (vErrors === null) {
            vErrors = [err14]
          } else {
            vErrors.push(err14)
          }
          errors++
        }
        if (!pattern2.test(data3)) {
          const err15 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/pattern",
            keyword: "pattern",
            params: { pattern: "^[ \\w.'+\\-%/À-ÖØ-öø-ÿ:&\\[\\]\\(\\)]+$" },
            message:
              'must match pattern "' +
              "^[ \\w.'+\\-%/À-ÖØ-öø-ÿ:&\\[\\]\\(\\)]+$" +
              '"',
          }
          if (vErrors === null) {
            vErrors = [err15]
          } else {
            vErrors.push(err15)
          }
          errors++
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err16]
        } else {
          vErrors.push(err16)
        }
        errors++
      }
    }
    if (data.symbol !== undefined) {
      let data4 = data.symbol
      if (typeof data4 === "string") {
        if (func4(data4) > 20) {
          const err17 = {
            instancePath: instancePath + "/symbol",
            schemaPath: "#/properties/symbol/maxLength",
            keyword: "maxLength",
            params: { limit: 20 },
            message: "must NOT have more than 20 characters",
          }
          if (vErrors === null) {
            vErrors = [err17]
          } else {
            vErrors.push(err17)
          }
          errors++
        }
        if (func4(data4) < 1) {
          const err18 = {
            instancePath: instancePath + "/symbol",
            schemaPath: "#/properties/symbol/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          }
          if (vErrors === null) {
            vErrors = [err18]
          } else {
            vErrors.push(err18)
          }
          errors++
        }
        if (!pattern3.test(data4)) {
          const err19 = {
            instancePath: instancePath + "/symbol",
            schemaPath: "#/properties/symbol/pattern",
            keyword: "pattern",
            params: { pattern: "^[a-zA-Z0-9+\\-%/$.]+$" },
            message: 'must match pattern "' + "^[a-zA-Z0-9+\\-%/$.]+$" + '"',
          }
          if (vErrors === null) {
            vErrors = [err19]
          } else {
            vErrors.push(err19)
          }
          errors++
        }
      } else {
        const err20 = {
          instancePath: instancePath + "/symbol",
          schemaPath: "#/properties/symbol/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err20]
        } else {
          vErrors.push(err20)
        }
        errors++
      }
    }
    if (data.logoURI !== undefined) {
      if (!(typeof data.logoURI === "string")) {
        const err21 = {
          instancePath: instancePath + "/logoURI",
          schemaPath: "#/properties/logoURI/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err21]
        } else {
          vErrors.push(err21)
        }
        errors++
      }
    }
    if (data.tags !== undefined) {
      let data6 = data.tags
      if (Array.isArray(data6)) {
        if (data6.length > 10) {
          const err22 = {
            instancePath: instancePath + "/tags",
            schemaPath: "#/properties/tags/maxItems",
            keyword: "maxItems",
            params: { limit: 10 },
            message: "must NOT have more than 10 items",
          }
          if (vErrors === null) {
            vErrors = [err22]
          } else {
            vErrors.push(err22)
          }
          errors++
        }
        const len0 = data6.length
        for (let i0 = 0; i0 < len0; i0++) {
          let data7 = data6[i0]
          if (typeof data7 === "string") {
            if (func4(data7) > 10) {
              const err23 = {
                instancePath: instancePath + "/tags/" + i0,
                schemaPath: "#/definitions/TagIdentifier/maxLength",
                keyword: "maxLength",
                params: { limit: 10 },
                message: "must NOT have more than 10 characters",
              }
              if (vErrors === null) {
                vErrors = [err23]
              } else {
                vErrors.push(err23)
              }
              errors++
            }
            if (func4(data7) < 1) {
              const err24 = {
                instancePath: instancePath + "/tags/" + i0,
                schemaPath: "#/definitions/TagIdentifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              }
              if (vErrors === null) {
                vErrors = [err24]
              } else {
                vErrors.push(err24)
              }
              errors++
            }
            if (!pattern4.test(data7)) {
              const err25 = {
                instancePath: instancePath + "/tags/" + i0,
                schemaPath: "#/definitions/TagIdentifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[\\w]+$" },
                message: 'must match pattern "' + "^[\\w]+$" + '"',
              }
              if (vErrors === null) {
                vErrors = [err25]
              } else {
                vErrors.push(err25)
              }
              errors++
            }
          } else {
            const err26 = {
              instancePath: instancePath + "/tags/" + i0,
              schemaPath: "#/definitions/TagIdentifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            }
            if (vErrors === null) {
              vErrors = [err26]
            } else {
              vErrors.push(err26)
            }
            errors++
          }
        }
      } else {
        const err27 = {
          instancePath: instancePath + "/tags",
          schemaPath: "#/properties/tags/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        }
        if (vErrors === null) {
          vErrors = [err27]
        } else {
          vErrors.push(err27)
        }
        errors++
      }
    }
    if (data.extensions !== undefined) {
      if (
        !validate13(data.extensions, {
          instancePath: instancePath + "/extensions",
          parentData: data,
          parentDataProperty: "extensions",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate13.errors
            : vErrors.concat(validate13.errors)
        errors = vErrors.length
      }
    }
  } else {
    const err28 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    }
    if (vErrors === null) {
      vErrors = [err28]
    } else {
      vErrors.push(err28)
    }
    errors++
  }
  validate12.errors = vErrors
  return errors === 0
}
function validate11(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {}
) {
  let vErrors = null
  let errors = 0
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.name === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "name" },
        message: "must have required property '" + "name" + "'",
      }
      if (vErrors === null) {
        vErrors = [err0]
      } else {
        vErrors.push(err0)
      }
      errors++
    }
    if (data.timestamp === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "timestamp" },
        message: "must have required property '" + "timestamp" + "'",
      }
      if (vErrors === null) {
        vErrors = [err1]
      } else {
        vErrors.push(err1)
      }
      errors++
    }
    if (data.version === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "version" },
        message: "must have required property '" + "version" + "'",
      }
      if (vErrors === null) {
        vErrors = [err2]
      } else {
        vErrors.push(err2)
      }
      errors++
    }
    if (data.tokens === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "tokens" },
        message: "must have required property '" + "tokens" + "'",
      }
      if (vErrors === null) {
        vErrors = [err3]
      } else {
        vErrors.push(err3)
      }
      errors++
    }
    for (const key0 in data) {
      if (
        !(
          key0 === "name" ||
          key0 === "timestamp" ||
          key0 === "version" ||
          key0 === "tokens" ||
          key0 === "keywords" ||
          key0 === "tags" ||
          key0 === "logoURI"
        )
      ) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        }
        if (vErrors === null) {
          vErrors = [err4]
        } else {
          vErrors.push(err4)
        }
        errors++
      }
    }
    if (data.name !== undefined) {
      let data0 = data.name
      if (typeof data0 === "string") {
        if (func4(data0) > 30) {
          const err5 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/maxLength",
            keyword: "maxLength",
            params: { limit: 30 },
            message: "must NOT have more than 30 characters",
          }
          if (vErrors === null) {
            vErrors = [err5]
          } else {
            vErrors.push(err5)
          }
          errors++
        }
        if (func4(data0) < 1) {
          const err6 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          }
          if (vErrors === null) {
            vErrors = [err6]
          } else {
            vErrors.push(err6)
          }
          errors++
        }
        if (!pattern0.test(data0)) {
          const err7 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/pattern",
            keyword: "pattern",
            params: { pattern: "^[\\w ]+$" },
            message: 'must match pattern "' + "^[\\w ]+$" + '"',
          }
          if (vErrors === null) {
            vErrors = [err7]
          } else {
            vErrors.push(err7)
          }
          errors++
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err8]
        } else {
          vErrors.push(err8)
        }
        errors++
      }
    }
    if (data.timestamp !== undefined) {
      if (!(typeof data.timestamp === "string")) {
        const err9 = {
          instancePath: instancePath + "/timestamp",
          schemaPath: "#/properties/timestamp/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err9]
        } else {
          vErrors.push(err9)
        }
        errors++
      }
    }
    if (data.version !== undefined) {
      let data2 = data.version
      if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
        if (data2.major === undefined) {
          const err10 = {
            instancePath: instancePath + "/version",
            schemaPath: "#/definitions/Version/required",
            keyword: "required",
            params: { missingProperty: "major" },
            message: "must have required property '" + "major" + "'",
          }
          if (vErrors === null) {
            vErrors = [err10]
          } else {
            vErrors.push(err10)
          }
          errors++
        }
        if (data2.minor === undefined) {
          const err11 = {
            instancePath: instancePath + "/version",
            schemaPath: "#/definitions/Version/required",
            keyword: "required",
            params: { missingProperty: "minor" },
            message: "must have required property '" + "minor" + "'",
          }
          if (vErrors === null) {
            vErrors = [err11]
          } else {
            vErrors.push(err11)
          }
          errors++
        }
        if (data2.patch === undefined) {
          const err12 = {
            instancePath: instancePath + "/version",
            schemaPath: "#/definitions/Version/required",
            keyword: "required",
            params: { missingProperty: "patch" },
            message: "must have required property '" + "patch" + "'",
          }
          if (vErrors === null) {
            vErrors = [err12]
          } else {
            vErrors.push(err12)
          }
          errors++
        }
        for (const key1 in data2) {
          if (!(key1 === "major" || key1 === "minor" || key1 === "patch")) {
            const err13 = {
              instancePath: instancePath + "/version",
              schemaPath: "#/definitions/Version/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            }
            if (vErrors === null) {
              vErrors = [err13]
            } else {
              vErrors.push(err13)
            }
            errors++
          }
        }
        if (data2.major !== undefined) {
          let data3 = data2.major
          if (
            !(
              typeof data3 == "number" &&
              !(data3 % 1) &&
              !isNaN(data3) &&
              isFinite(data3)
            )
          ) {
            const err14 = {
              instancePath: instancePath + "/version/major",
              schemaPath: "#/definitions/Version/properties/major/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            }
            if (vErrors === null) {
              vErrors = [err14]
            } else {
              vErrors.push(err14)
            }
            errors++
          }
          if (typeof data3 == "number" && isFinite(data3)) {
            if (data3 < 0 || isNaN(data3)) {
              const err15 = {
                instancePath: instancePath + "/version/major",
                schemaPath: "#/definitions/Version/properties/major/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              }
              if (vErrors === null) {
                vErrors = [err15]
              } else {
                vErrors.push(err15)
              }
              errors++
            }
          }
        }
        if (data2.minor !== undefined) {
          let data4 = data2.minor
          if (
            !(
              typeof data4 == "number" &&
              !(data4 % 1) &&
              !isNaN(data4) &&
              isFinite(data4)
            )
          ) {
            const err16 = {
              instancePath: instancePath + "/version/minor",
              schemaPath: "#/definitions/Version/properties/minor/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            }
            if (vErrors === null) {
              vErrors = [err16]
            } else {
              vErrors.push(err16)
            }
            errors++
          }
          if (typeof data4 == "number" && isFinite(data4)) {
            if (data4 < 0 || isNaN(data4)) {
              const err17 = {
                instancePath: instancePath + "/version/minor",
                schemaPath: "#/definitions/Version/properties/minor/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              }
              if (vErrors === null) {
                vErrors = [err17]
              } else {
                vErrors.push(err17)
              }
              errors++
            }
          }
        }
        if (data2.patch !== undefined) {
          let data5 = data2.patch
          if (
            !(
              typeof data5 == "number" &&
              !(data5 % 1) &&
              !isNaN(data5) &&
              isFinite(data5)
            )
          ) {
            const err18 = {
              instancePath: instancePath + "/version/patch",
              schemaPath: "#/definitions/Version/properties/patch/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            }
            if (vErrors === null) {
              vErrors = [err18]
            } else {
              vErrors.push(err18)
            }
            errors++
          }
          if (typeof data5 == "number" && isFinite(data5)) {
            if (data5 < 0 || isNaN(data5)) {
              const err19 = {
                instancePath: instancePath + "/version/patch",
                schemaPath: "#/definitions/Version/properties/patch/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              }
              if (vErrors === null) {
                vErrors = [err19]
              } else {
                vErrors.push(err19)
              }
              errors++
            }
          }
        }
      } else {
        const err20 = {
          instancePath: instancePath + "/version",
          schemaPath: "#/definitions/Version/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        }
        if (vErrors === null) {
          vErrors = [err20]
        } else {
          vErrors.push(err20)
        }
        errors++
      }
    }
    if (data.tokens !== undefined) {
      let data6 = data.tokens
      if (Array.isArray(data6)) {
        if (data6.length > 10000) {
          const err21 = {
            instancePath: instancePath + "/tokens",
            schemaPath: "#/properties/tokens/maxItems",
            keyword: "maxItems",
            params: { limit: 10000 },
            message: "must NOT have more than 10000 items",
          }
          if (vErrors === null) {
            vErrors = [err21]
          } else {
            vErrors.push(err21)
          }
          errors++
        }
        if (data6.length < 1) {
          const err22 = {
            instancePath: instancePath + "/tokens",
            schemaPath: "#/properties/tokens/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          }
          if (vErrors === null) {
            vErrors = [err22]
          } else {
            vErrors.push(err22)
          }
          errors++
        }
        const len0 = data6.length
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate12(data6[i0], {
              instancePath: instancePath + "/tokens/" + i0,
              parentData: data6,
              parentDataProperty: i0,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate12.errors
                : vErrors.concat(validate12.errors)
            errors = vErrors.length
          }
        }
      } else {
        const err23 = {
          instancePath: instancePath + "/tokens",
          schemaPath: "#/properties/tokens/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        }
        if (vErrors === null) {
          vErrors = [err23]
        } else {
          vErrors.push(err23)
        }
        errors++
      }
    }
    if (data.keywords !== undefined) {
      let data8 = data.keywords
      if (Array.isArray(data8)) {
        if (data8.length > 20) {
          const err24 = {
            instancePath: instancePath + "/keywords",
            schemaPath: "#/properties/keywords/maxItems",
            keyword: "maxItems",
            params: { limit: 20 },
            message: "must NOT have more than 20 items",
          }
          if (vErrors === null) {
            vErrors = [err24]
          } else {
            vErrors.push(err24)
          }
          errors++
        }
        const len1 = data8.length
        for (let i1 = 0; i1 < len1; i1++) {
          let data9 = data8[i1]
          if (typeof data9 === "string") {
            if (func4(data9) > 20) {
              const err25 = {
                instancePath: instancePath + "/keywords/" + i1,
                schemaPath: "#/properties/keywords/items/maxLength",
                keyword: "maxLength",
                params: { limit: 20 },
                message: "must NOT have more than 20 characters",
              }
              if (vErrors === null) {
                vErrors = [err25]
              } else {
                vErrors.push(err25)
              }
              errors++
            }
            if (func4(data9) < 1) {
              const err26 = {
                instancePath: instancePath + "/keywords/" + i1,
                schemaPath: "#/properties/keywords/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              }
              if (vErrors === null) {
                vErrors = [err26]
              } else {
                vErrors.push(err26)
              }
              errors++
            }
            if (!pattern0.test(data9)) {
              const err27 = {
                instancePath: instancePath + "/keywords/" + i1,
                schemaPath: "#/properties/keywords/items/pattern",
                keyword: "pattern",
                params: { pattern: "^[\\w ]+$" },
                message: 'must match pattern "' + "^[\\w ]+$" + '"',
              }
              if (vErrors === null) {
                vErrors = [err27]
              } else {
                vErrors.push(err27)
              }
              errors++
            }
          } else {
            const err28 = {
              instancePath: instancePath + "/keywords/" + i1,
              schemaPath: "#/properties/keywords/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            }
            if (vErrors === null) {
              vErrors = [err28]
            } else {
              vErrors.push(err28)
            }
            errors++
          }
        }
        let i2 = data8.length
        let j0
        if (i2 > 1) {
          const indices0 = {}
          for (; i2--; ) {
            let item0 = data8[i2]
            if (typeof item0 !== "string") {
              continue
            }
            if (typeof indices0[item0] == "number") {
              j0 = indices0[item0]
              const err29 = {
                instancePath: instancePath + "/keywords",
                schemaPath: "#/properties/keywords/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i2, j: j0 },
                message:
                  "must NOT have duplicate items (items ## " +
                  j0 +
                  " and " +
                  i2 +
                  " are identical)",
              }
              if (vErrors === null) {
                vErrors = [err29]
              } else {
                vErrors.push(err29)
              }
              errors++
              break
            }
            indices0[item0] = i2
          }
        }
      } else {
        const err30 = {
          instancePath: instancePath + "/keywords",
          schemaPath: "#/properties/keywords/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        }
        if (vErrors === null) {
          vErrors = [err30]
        } else {
          vErrors.push(err30)
        }
        errors++
      }
    }
    if (data.tags !== undefined) {
      let data10 = data.tags
      if (data10 && typeof data10 == "object" && !Array.isArray(data10)) {
        if (Object.keys(data10).length > 20) {
          const err31 = {
            instancePath: instancePath + "/tags",
            schemaPath: "#/properties/tags/maxProperties",
            keyword: "maxProperties",
            params: { limit: 20 },
            message: "must NOT have more than 20 items",
          }
          if (vErrors === null) {
            vErrors = [err31]
          } else {
            vErrors.push(err31)
          }
          errors++
        }
        for (const key2 in data10) {
          const _errs25 = errors
          if (typeof key2 === "string") {
            if (func4(key2) > 10) {
              const err32 = {
                instancePath: instancePath + "/tags",
                schemaPath: "#/definitions/TagIdentifier/maxLength",
                keyword: "maxLength",
                params: { limit: 10 },
                message: "must NOT have more than 10 characters",
                propertyName: key2,
              }
              if (vErrors === null) {
                vErrors = [err32]
              } else {
                vErrors.push(err32)
              }
              errors++
            }
            if (func4(key2) < 1) {
              const err33 = {
                instancePath: instancePath + "/tags",
                schemaPath: "#/definitions/TagIdentifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
                propertyName: key2,
              }
              if (vErrors === null) {
                vErrors = [err33]
              } else {
                vErrors.push(err33)
              }
              errors++
            }
            if (!pattern4.test(key2)) {
              const err34 = {
                instancePath: instancePath + "/tags",
                schemaPath: "#/definitions/TagIdentifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[\\w]+$" },
                message: 'must match pattern "' + "^[\\w]+$" + '"',
                propertyName: key2,
              }
              if (vErrors === null) {
                vErrors = [err34]
              } else {
                vErrors.push(err34)
              }
              errors++
            }
          } else {
            const err35 = {
              instancePath: instancePath + "/tags",
              schemaPath: "#/definitions/TagIdentifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              propertyName: key2,
            }
            if (vErrors === null) {
              vErrors = [err35]
            } else {
              vErrors.push(err35)
            }
            errors++
          }
          var valid8 = _errs25 === errors
          if (!valid8) {
            const err36 = {
              instancePath: instancePath + "/tags",
              schemaPath: "#/properties/tags/propertyNames",
              keyword: "propertyNames",
              params: { propertyName: key2 },
              message: "property name must be valid",
            }
            if (vErrors === null) {
              vErrors = [err36]
            } else {
              vErrors.push(err36)
            }
            errors++
          }
        }
        for (const key3 in data10) {
          let data11 = data10[key3]
          if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
            if (data11.name === undefined) {
              const err37 = {
                instancePath:
                  instancePath +
                  "/tags/" +
                  key3.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath: "#/definitions/TagDefinition/required",
                keyword: "required",
                params: { missingProperty: "name" },
                message: "must have required property '" + "name" + "'",
              }
              if (vErrors === null) {
                vErrors = [err37]
              } else {
                vErrors.push(err37)
              }
              errors++
            }
            if (data11.description === undefined) {
              const err38 = {
                instancePath:
                  instancePath +
                  "/tags/" +
                  key3.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath: "#/definitions/TagDefinition/required",
                keyword: "required",
                params: { missingProperty: "description" },
                message: "must have required property '" + "description" + "'",
              }
              if (vErrors === null) {
                vErrors = [err38]
              } else {
                vErrors.push(err38)
              }
              errors++
            }
            for (const key4 in data11) {
              if (!(key4 === "name" || key4 === "description")) {
                const err39 = {
                  instancePath:
                    instancePath +
                    "/tags/" +
                    key3.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/TagDefinition/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key4 },
                  message: "must NOT have additional properties",
                }
                if (vErrors === null) {
                  vErrors = [err39]
                } else {
                  vErrors.push(err39)
                }
                errors++
              }
            }
            if (data11.name !== undefined) {
              let data12 = data11.name
              if (typeof data12 === "string") {
                if (func4(data12) > 20) {
                  const err40 = {
                    instancePath:
                      instancePath +
                      "/tags/" +
                      key3.replace(/~/g, "~0").replace(/\//g, "~1") +
                      "/name",
                    schemaPath:
                      "#/definitions/TagDefinition/properties/name/maxLength",
                    keyword: "maxLength",
                    params: { limit: 20 },
                    message: "must NOT have more than 20 characters",
                  }
                  if (vErrors === null) {
                    vErrors = [err40]
                  } else {
                    vErrors.push(err40)
                  }
                  errors++
                }
                if (func4(data12) < 1) {
                  const err41 = {
                    instancePath:
                      instancePath +
                      "/tags/" +
                      key3.replace(/~/g, "~0").replace(/\//g, "~1") +
                      "/name",
                    schemaPath:
                      "#/definitions/TagDefinition/properties/name/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  }
                  if (vErrors === null) {
                    vErrors = [err41]
                  } else {
                    vErrors.push(err41)
                  }
                  errors++
                }
                if (!pattern10.test(data12)) {
                  const err42 = {
                    instancePath:
                      instancePath +
                      "/tags/" +
                      key3.replace(/~/g, "~0").replace(/\//g, "~1") +
                      "/name",
                    schemaPath:
                      "#/definitions/TagDefinition/properties/name/pattern",
                    keyword: "pattern",
                    params: { pattern: "^[ \\w]+$" },
                    message: 'must match pattern "' + "^[ \\w]+$" + '"',
                  }
                  if (vErrors === null) {
                    vErrors = [err42]
                  } else {
                    vErrors.push(err42)
                  }
                  errors++
                }
              } else {
                const err43 = {
                  instancePath:
                    instancePath +
                    "/tags/" +
                    key3.replace(/~/g, "~0").replace(/\//g, "~1") +
                    "/name",
                  schemaPath:
                    "#/definitions/TagDefinition/properties/name/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                }
                if (vErrors === null) {
                  vErrors = [err43]
                } else {
                  vErrors.push(err43)
                }
                errors++
              }
            }
            if (data11.description !== undefined) {
              let data13 = data11.description
              if (typeof data13 === "string") {
                if (func4(data13) > 200) {
                  const err44 = {
                    instancePath:
                      instancePath +
                      "/tags/" +
                      key3.replace(/~/g, "~0").replace(/\//g, "~1") +
                      "/description",
                    schemaPath:
                      "#/definitions/TagDefinition/properties/description/maxLength",
                    keyword: "maxLength",
                    params: { limit: 200 },
                    message: "must NOT have more than 200 characters",
                  }
                  if (vErrors === null) {
                    vErrors = [err44]
                  } else {
                    vErrors.push(err44)
                  }
                  errors++
                }
                if (func4(data13) < 1) {
                  const err45 = {
                    instancePath:
                      instancePath +
                      "/tags/" +
                      key3.replace(/~/g, "~0").replace(/\//g, "~1") +
                      "/description",
                    schemaPath:
                      "#/definitions/TagDefinition/properties/description/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  }
                  if (vErrors === null) {
                    vErrors = [err45]
                  } else {
                    vErrors.push(err45)
                  }
                  errors++
                }
                if (!pattern11.test(data13)) {
                  const err46 = {
                    instancePath:
                      instancePath +
                      "/tags/" +
                      key3.replace(/~/g, "~0").replace(/\//g, "~1") +
                      "/description",
                    schemaPath:
                      "#/definitions/TagDefinition/properties/description/pattern",
                    keyword: "pattern",
                    params: { pattern: "^[ \\w\\.,:]+$" },
                    message: 'must match pattern "' + "^[ \\w\\.,:]+$" + '"',
                  }
                  if (vErrors === null) {
                    vErrors = [err46]
                  } else {
                    vErrors.push(err46)
                  }
                  errors++
                }
              } else {
                const err47 = {
                  instancePath:
                    instancePath +
                    "/tags/" +
                    key3.replace(/~/g, "~0").replace(/\//g, "~1") +
                    "/description",
                  schemaPath:
                    "#/definitions/TagDefinition/properties/description/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                }
                if (vErrors === null) {
                  vErrors = [err47]
                } else {
                  vErrors.push(err47)
                }
                errors++
              }
            }
          } else {
            const err48 = {
              instancePath:
                instancePath +
                "/tags/" +
                key3.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath: "#/definitions/TagDefinition/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            }
            if (vErrors === null) {
              vErrors = [err48]
            } else {
              vErrors.push(err48)
            }
            errors++
          }
        }
      } else {
        const err49 = {
          instancePath: instancePath + "/tags",
          schemaPath: "#/properties/tags/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        }
        if (vErrors === null) {
          vErrors = [err49]
        } else {
          vErrors.push(err49)
        }
        errors++
      }
    }
    if (data.logoURI !== undefined) {
      if (!(typeof data.logoURI === "string")) {
        const err50 = {
          instancePath: instancePath + "/logoURI",
          schemaPath: "#/properties/logoURI/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err50]
        } else {
          vErrors.push(err50)
        }
        errors++
      }
    }
  } else {
    const err51 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    }
    if (vErrors === null) {
      vErrors = [err51]
    } else {
      vErrors.push(err51)
    }
    errors++
  }
  validate11.errors = vErrors
  return errors === 0
}
