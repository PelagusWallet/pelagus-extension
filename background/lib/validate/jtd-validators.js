"use strict"
exports.isValidMetadata = validate57
var schema29 = {
  optionalProperties: {
    name: { type: "string" },
    description: { type: "string" },
    image: { type: "string" },
    title: { type: "string" },
    external_url: { type: "string" },
  },
  additionalProperties: true,
}
function validate57(data, valCxt) {
  "use strict"
  if (valCxt) {
    var instancePath = valCxt.instancePath
    var parentData = valCxt.parentData
    var parentDataProperty = valCxt.parentDataProperty
    var rootData = valCxt.rootData
  } else {
    var instancePath = ""
    var parentData = undefined
    var parentDataProperty = undefined
    var rootData = data
  }
  var vErrors = null
  var errors = 0
  var valid0 = false
  if (data && typeof data == "object" && !Array.isArray(data)) {
    valid0 = true
    if (data.name !== undefined) {
      if (!(typeof data.name == "string")) {
        var err0 = {
          instancePath: instancePath + "/name",
          schemaPath: "/optionalProperties/name/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err0]
        } else {
          vErrors.push(err0)
        }
        errors++
      }
    }
    if (data.description !== undefined) {
      if (!(typeof data.description == "string")) {
        var err1 = {
          instancePath: instancePath + "/description",
          schemaPath: "/optionalProperties/description/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err1]
        } else {
          vErrors.push(err1)
        }
        errors++
      }
    }
    if (data.image !== undefined) {
      if (!(typeof data.image == "string")) {
        var err2 = {
          instancePath: instancePath + "/image",
          schemaPath: "/optionalProperties/image/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err2]
        } else {
          vErrors.push(err2)
        }
        errors++
      }
    }
    if (data.title !== undefined) {
      if (!(typeof data.title == "string")) {
        var err3 = {
          instancePath: instancePath + "/title",
          schemaPath: "/optionalProperties/title/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err3]
        } else {
          vErrors.push(err3)
        }
        errors++
      }
    }
    if (data.external_url !== undefined) {
      if (!(typeof data.external_url == "string")) {
        var err4 = {
          instancePath: instancePath + "/external_url",
          schemaPath: "/optionalProperties/external_url/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err4]
        } else {
          vErrors.push(err4)
        }
        errors++
      }
    }
  }
  if (!valid0) {
    var err5 = {
      instancePath: instancePath,
      schemaPath: "/optionalProperties",
      keyword: "optionalProperties",
      params: { type: "object", nullable: false },
      message: "must be object",
    }
    if (vErrors === null) {
      vErrors = [err5]
    } else {
      vErrors.push(err5)
    }
    errors++
  }
  validate57.errors = vErrors
  return errors === 0
}
exports.isValidAlchemyAssetTransferResponse = validate58
var schema30 = {
  properties: {
    transfers: {
      elements: {
        properties: {
          asset: { type: "string", nullable: true },
          hash: { type: "string" },
          blockNum: { type: "string" },
          category: {
            enum: ["token", "internal", "external", "erc20", "erc1155"],
          },
          from: { type: "string", nullable: true },
          to: { type: "string", nullable: true },
        },
        optionalProperties: {
          rawContract: {
            properties: {
              address: { type: "string", nullable: true },
              decimal: { type: "string", nullable: true },
              value: { type: "string", nullable: true },
            },
          },
        },
        additionalProperties: true,
      },
    },
  },
  additionalProperties: true,
}
function validate58(data, valCxt) {
  "use strict"
  if (valCxt) {
    var instancePath = valCxt.instancePath
    var parentData = valCxt.parentData
    var parentDataProperty = valCxt.parentDataProperty
    var rootData = valCxt.rootData
  } else {
    var instancePath = ""
    var parentData = undefined
    var parentDataProperty = undefined
    var rootData = data
  }
  var vErrors = null
  var errors = 0
  var valid0 = false
  if (data && typeof data == "object" && !Array.isArray(data)) {
    valid0 = true
    if (data.transfers !== undefined) {
      var data0 = data.transfers
      var valid2 = false
      if (!valid2) {
        if (Array.isArray(data0)) {
          var valid4 = true
          var len0 = data0.length
          for (var i0 = 0; i0 < len0; i0++) {
            var data1 = data0[i0]
            var _errs1 = errors
            var valid5 = false
            if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
              valid5 = true
              if (data1.asset !== undefined) {
                var data2 = data1.asset
                if (!(data2 === null || typeof data2 == "string")) {
                  var err0 = {
                    instancePath: instancePath + "/transfers/" + i0 + "/asset",
                    schemaPath:
                      "/properties/transfers/elements/properties/asset/type",
                    keyword: "type",
                    params: { type: "string", nullable: true },
                    message: "must be string or null",
                  }
                  if (vErrors === null) {
                    vErrors = [err0]
                  } else {
                    vErrors.push(err0)
                  }
                  errors++
                }
              } else {
                var err1 = {
                  instancePath: instancePath + "/transfers/" + i0,
                  schemaPath: "/properties/transfers/elements/properties/asset",
                  keyword: "properties",
                  params: { error: "missing", missingProperty: "asset" },
                  message: "must have property 'asset'",
                }
                if (vErrors === null) {
                  vErrors = [err1]
                } else {
                  vErrors.push(err1)
                }
                errors++
              }
              if (data1.hash !== undefined) {
                if (!(typeof data1.hash == "string")) {
                  var err2 = {
                    instancePath: instancePath + "/transfers/" + i0 + "/hash",
                    schemaPath:
                      "/properties/transfers/elements/properties/hash/type",
                    keyword: "type",
                    params: { type: "string", nullable: false },
                    message: "must be string",
                  }
                  if (vErrors === null) {
                    vErrors = [err2]
                  } else {
                    vErrors.push(err2)
                  }
                  errors++
                }
              } else {
                var err3 = {
                  instancePath: instancePath + "/transfers/" + i0,
                  schemaPath: "/properties/transfers/elements/properties/hash",
                  keyword: "properties",
                  params: { error: "missing", missingProperty: "hash" },
                  message: "must have property 'hash'",
                }
                if (vErrors === null) {
                  vErrors = [err3]
                } else {
                  vErrors.push(err3)
                }
                errors++
              }
              if (data1.blockNum !== undefined) {
                if (!(typeof data1.blockNum == "string")) {
                  var err4 = {
                    instancePath:
                      instancePath + "/transfers/" + i0 + "/blockNum",
                    schemaPath:
                      "/properties/transfers/elements/properties/blockNum/type",
                    keyword: "type",
                    params: { type: "string", nullable: false },
                    message: "must be string",
                  }
                  if (vErrors === null) {
                    vErrors = [err4]
                  } else {
                    vErrors.push(err4)
                  }
                  errors++
                }
              } else {
                var err5 = {
                  instancePath: instancePath + "/transfers/" + i0,
                  schemaPath:
                    "/properties/transfers/elements/properties/blockNum",
                  keyword: "properties",
                  params: { error: "missing", missingProperty: "blockNum" },
                  message: "must have property 'blockNum'",
                }
                if (vErrors === null) {
                  vErrors = [err5]
                } else {
                  vErrors.push(err5)
                }
                errors++
              }
              if (data1.category !== undefined) {
                var data5 = data1.category
                if (
                  !(
                    typeof data5 == "string" &&
                    (data5 === "token" ||
                      data5 === "internal" ||
                      data5 === "external" ||
                      data5 === "erc20" ||
                      data5 === "erc1155")
                  )
                ) {
                  var err6 = {
                    instancePath:
                      instancePath + "/transfers/" + i0 + "/category",
                    schemaPath:
                      "/properties/transfers/elements/properties/category/enum",
                    keyword: "enum",
                    params: {
                      allowedValues:
                        schema30.properties.transfers.elements.properties
                          .category.enum,
                    },
                    message: "must be equal to one of the allowed values",
                  }
                  if (vErrors === null) {
                    vErrors = [err6]
                  } else {
                    vErrors.push(err6)
                  }
                  errors++
                }
              } else {
                var err7 = {
                  instancePath: instancePath + "/transfers/" + i0,
                  schemaPath:
                    "/properties/transfers/elements/properties/category",
                  keyword: "properties",
                  params: { error: "missing", missingProperty: "category" },
                  message: "must have property 'category'",
                }
                if (vErrors === null) {
                  vErrors = [err7]
                } else {
                  vErrors.push(err7)
                }
                errors++
              }
              if (data1.from !== undefined) {
                var data6 = data1.from
                if (!(data6 === null || typeof data6 == "string")) {
                  var err8 = {
                    instancePath: instancePath + "/transfers/" + i0 + "/from",
                    schemaPath:
                      "/properties/transfers/elements/properties/from/type",
                    keyword: "type",
                    params: { type: "string", nullable: true },
                    message: "must be string or null",
                  }
                  if (vErrors === null) {
                    vErrors = [err8]
                  } else {
                    vErrors.push(err8)
                  }
                  errors++
                }
              } else {
                var err9 = {
                  instancePath: instancePath + "/transfers/" + i0,
                  schemaPath: "/properties/transfers/elements/properties/from",
                  keyword: "properties",
                  params: { error: "missing", missingProperty: "from" },
                  message: "must have property 'from'",
                }
                if (vErrors === null) {
                  vErrors = [err9]
                } else {
                  vErrors.push(err9)
                }
                errors++
              }
              if (data1.to !== undefined) {
                var data7 = data1.to
                if (!(data7 === null || typeof data7 == "string")) {
                  var err10 = {
                    instancePath: instancePath + "/transfers/" + i0 + "/to",
                    schemaPath:
                      "/properties/transfers/elements/properties/to/type",
                    keyword: "type",
                    params: { type: "string", nullable: true },
                    message: "must be string or null",
                  }
                  if (vErrors === null) {
                    vErrors = [err10]
                  } else {
                    vErrors.push(err10)
                  }
                  errors++
                }
              } else {
                var err11 = {
                  instancePath: instancePath + "/transfers/" + i0,
                  schemaPath: "/properties/transfers/elements/properties/to",
                  keyword: "properties",
                  params: { error: "missing", missingProperty: "to" },
                  message: "must have property 'to'",
                }
                if (vErrors === null) {
                  vErrors = [err11]
                } else {
                  vErrors.push(err11)
                }
                errors++
              }
              if (data1.rawContract !== undefined) {
                var data9 = data1.rawContract
                var valid8 = false
                if (
                  data9 &&
                  typeof data9 == "object" &&
                  !Array.isArray(data9)
                ) {
                  valid8 = true
                  if (data9.address !== undefined) {
                    var data10 = data9.address
                    if (!(data10 === null || typeof data10 == "string")) {
                      var err14 = {
                        instancePath:
                          instancePath +
                          "/transfers/" +
                          i0 +
                          "/rawContract/address",
                        schemaPath:
                          "/properties/transfers/elements/optionalProperties/rawContract/properties/address/type",
                        keyword: "type",
                        params: { type: "string", nullable: true },
                        message: "must be string or null",
                      }
                      if (vErrors === null) {
                        vErrors = [err14]
                      } else {
                        vErrors.push(err14)
                      }
                      errors++
                    }
                  } else {
                    var err15 = {
                      instancePath:
                        instancePath + "/transfers/" + i0 + "/rawContract",
                      schemaPath:
                        "/properties/transfers/elements/optionalProperties/rawContract/properties/address",
                      keyword: "properties",
                      params: { error: "missing", missingProperty: "address" },
                      message: "must have property 'address'",
                    }
                    if (vErrors === null) {
                      vErrors = [err15]
                    } else {
                      vErrors.push(err15)
                    }
                    errors++
                  }
                  if (data9.decimal !== undefined) {
                    var data11 = data9.decimal
                    if (!(data11 === null || typeof data11 == "string")) {
                      var err16 = {
                        instancePath:
                          instancePath +
                          "/transfers/" +
                          i0 +
                          "/rawContract/decimal",
                        schemaPath:
                          "/properties/transfers/elements/optionalProperties/rawContract/properties/decimal/type",
                        keyword: "type",
                        params: { type: "string", nullable: true },
                        message: "must be string or null",
                      }
                      if (vErrors === null) {
                        vErrors = [err16]
                      } else {
                        vErrors.push(err16)
                      }
                      errors++
                    }
                  } else {
                    var err17 = {
                      instancePath:
                        instancePath + "/transfers/" + i0 + "/rawContract",
                      schemaPath:
                        "/properties/transfers/elements/optionalProperties/rawContract/properties/decimal",
                      keyword: "properties",
                      params: { error: "missing", missingProperty: "decimal" },
                      message: "must have property 'decimal'",
                    }
                    if (vErrors === null) {
                      vErrors = [err17]
                    } else {
                      vErrors.push(err17)
                    }
                    errors++
                  }
                  if (data9.value !== undefined) {
                    var data12 = data9.value
                    if (!(data12 === null || typeof data12 == "string")) {
                      var err18 = {
                        instancePath:
                          instancePath +
                          "/transfers/" +
                          i0 +
                          "/rawContract/value",
                        schemaPath:
                          "/properties/transfers/elements/optionalProperties/rawContract/properties/value/type",
                        keyword: "type",
                        params: { type: "string", nullable: true },
                        message: "must be string or null",
                      }
                      if (vErrors === null) {
                        vErrors = [err18]
                      } else {
                        vErrors.push(err18)
                      }
                      errors++
                    }
                  } else {
                    var err19 = {
                      instancePath:
                        instancePath + "/transfers/" + i0 + "/rawContract",
                      schemaPath:
                        "/properties/transfers/elements/optionalProperties/rawContract/properties/value",
                      keyword: "properties",
                      params: { error: "missing", missingProperty: "value" },
                      message: "must have property 'value'",
                    }
                    if (vErrors === null) {
                      vErrors = [err19]
                    } else {
                      vErrors.push(err19)
                    }
                    errors++
                  }
                  for (var key0 in data9) {
                    if (
                      key0 !== "address" &&
                      key0 !== "decimal" &&
                      key0 !== "value"
                    ) {
                      var err20 = {
                        instancePath:
                          instancePath +
                          "/transfers/" +
                          i0 +
                          "/rawContract/" +
                          key0.replace(/~/g, "~0").replace(/\//g, "~1"),
                        schemaPath:
                          "/properties/transfers/elements/optionalProperties/rawContract",
                        keyword: "properties",
                        params: {
                          error: "additional",
                          additionalProperty: key0,
                        },
                        message: "must NOT have additional properties",
                      }
                      if (vErrors === null) {
                        vErrors = [err20]
                      } else {
                        vErrors.push(err20)
                      }
                      errors++
                    }
                  }
                }
                if (!valid8) {
                  var err21 = {
                    instancePath:
                      instancePath + "/transfers/" + i0 + "/rawContract",
                    schemaPath:
                      "/properties/transfers/elements/optionalProperties/rawContract/properties",
                    keyword: "properties",
                    params: { type: "object", nullable: false },
                    message: "must be object",
                  }
                  if (vErrors === null) {
                    vErrors = [err21]
                  } else {
                    vErrors.push(err21)
                  }
                  errors++
                }
              }
            }
            if (!valid5) {
              var err22 = {
                instancePath: instancePath + "/transfers/" + i0,
                schemaPath: "/properties/transfers/elements/properties",
                keyword: "properties",
                params: { type: "object", nullable: false },
                message: "must be object",
              }
              if (vErrors === null) {
                vErrors = [err22]
              } else {
                vErrors.push(err22)
              }
              errors++
            }
            var valid3 = _errs1 === errors
            if (!valid3) {
              valid4 = false
            }
          }
          valid2 = valid4
        } else {
          var err23 = {
            instancePath: instancePath + "/transfers",
            schemaPath: "/properties/transfers/elements",
            keyword: "elements",
            params: { type: "array", nullable: false },
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
    } else {
      var err24 = {
        instancePath: instancePath,
        schemaPath: "/properties/transfers",
        keyword: "properties",
        params: { error: "missing", missingProperty: "transfers" },
        message: "must have property 'transfers'",
      }
      if (vErrors === null) {
        vErrors = [err24]
      } else {
        vErrors.push(err24)
      }
      errors++
    }
  }
  if (!valid0) {
    var err25 = {
      instancePath: instancePath,
      schemaPath: "/properties",
      keyword: "properties",
      params: { type: "object", nullable: false },
      message: "must be object",
    }
    if (vErrors === null) {
      vErrors = [err25]
    } else {
      vErrors.push(err25)
    }
    errors++
  }
  validate58.errors = vErrors
  return errors === 0
}
exports.isValidAlchemyTokenBalanceResponse = validate59
var schema31 = {
  properties: {
    address: { type: "string" },
    tokenBalances: {
      elements: {
        properties: { contractAddress: { type: "string" }, error: {} },
        optionalProperties: {
          tokenBalance: { type: "string", nullable: true },
        },
      },
    },
  },
  optionalProperties: { pageKey: { type: "string" } },
  additionalProperties: false,
}
function validate59(data, valCxt) {
  "use strict"
  if (valCxt) {
    var instancePath = valCxt.instancePath
    var parentData = valCxt.parentData
    var parentDataProperty = valCxt.parentDataProperty
    var rootData = valCxt.rootData
  } else {
    var instancePath = ""
    var parentData = undefined
    var parentDataProperty = undefined
    var rootData = data
  }
  var vErrors = null
  var errors = 0
  var valid0 = false
  if (data && typeof data == "object" && !Array.isArray(data)) {
    valid0 = true
    if (data.address !== undefined) {
      if (!(typeof data.address == "string")) {
        var err0 = {
          instancePath: instancePath + "/address",
          schemaPath: "/properties/address/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err0]
        } else {
          vErrors.push(err0)
        }
        errors++
      }
    } else {
      var err1 = {
        instancePath: instancePath,
        schemaPath: "/properties/address",
        keyword: "properties",
        params: { error: "missing", missingProperty: "address" },
        message: "must have property 'address'",
      }
      if (vErrors === null) {
        vErrors = [err1]
      } else {
        vErrors.push(err1)
      }
      errors++
    }
    if (data.tokenBalances !== undefined) {
      var data1 = data.tokenBalances
      var valid2 = false
      if (!valid2) {
        if (Array.isArray(data1)) {
          var valid4 = true
          var len0 = data1.length
          for (var i0 = 0; i0 < len0; i0++) {
            var data2 = data1[i0]
            var _errs2 = errors
            var valid5 = false
            if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
              valid5 = true
              if (data2.contractAddress !== undefined) {
                if (!(typeof data2.contractAddress == "string")) {
                  var err2 = {
                    instancePath:
                      instancePath +
                      "/tokenBalances/" +
                      i0 +
                      "/contractAddress",
                    schemaPath:
                      "/properties/tokenBalances/elements/properties/contractAddress/type",
                    keyword: "type",
                    params: { type: "string", nullable: false },
                    message: "must be string",
                  }
                  if (vErrors === null) {
                    vErrors = [err2]
                  } else {
                    vErrors.push(err2)
                  }
                  errors++
                }
              } else {
                var err3 = {
                  instancePath: instancePath + "/tokenBalances/" + i0,
                  schemaPath:
                    "/properties/tokenBalances/elements/properties/contractAddress",
                  keyword: "properties",
                  params: {
                    error: "missing",
                    missingProperty: "contractAddress",
                  },
                  message: "must have property 'contractAddress'",
                }
                if (vErrors === null) {
                  vErrors = [err3]
                } else {
                  vErrors.push(err3)
                }
                errors++
              }
              if (data2.tokenBalance !== undefined) {
                var data4 = data2.tokenBalance
                if (!(data4 === null || typeof data4 == "string")) {
                  var err4 = {
                    instancePath:
                      instancePath + "/tokenBalances/" + i0 + "/tokenBalance",
                    schemaPath:
                      "/properties/tokenBalances/elements/optionalProperties/tokenBalance/type",
                    keyword: "type",
                    params: { type: "string", nullable: true },
                    message: "must be string or null",
                  }
                  if (vErrors === null) {
                    vErrors = [err4]
                  } else {
                    vErrors.push(err4)
                  }
                  errors++
                }
              }
              for (var key0 in data2) {
                if (
                  key0 !== "contractAddress" &&
                  key0 !== "error" &&
                  key0 !== "tokenBalance"
                ) {
                  var err5 = {
                    instancePath:
                      instancePath +
                      "/tokenBalances/" +
                      i0 +
                      "/" +
                      key0.replace(/~/g, "~0").replace(/\//g, "~1"),
                    schemaPath: "/properties/tokenBalances/elements",
                    keyword: "properties",
                    params: { error: "additional", additionalProperty: key0 },
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
            }
            if (!valid5) {
              var err6 = {
                instancePath: instancePath + "/tokenBalances/" + i0,
                schemaPath: "/properties/tokenBalances/elements/properties",
                keyword: "properties",
                params: { type: "object", nullable: false },
                message: "must be object",
              }
              if (vErrors === null) {
                vErrors = [err6]
              } else {
                vErrors.push(err6)
              }
              errors++
            }
            var valid3 = _errs2 === errors
            if (!valid3) {
              valid4 = false
            }
          }
          valid2 = valid4
        } else {
          var err7 = {
            instancePath: instancePath + "/tokenBalances",
            schemaPath: "/properties/tokenBalances/elements",
            keyword: "elements",
            params: { type: "array", nullable: false },
            message: "must be array",
          }
          if (vErrors === null) {
            vErrors = [err7]
          } else {
            vErrors.push(err7)
          }
          errors++
        }
      }
    } else {
      var err8 = {
        instancePath: instancePath,
        schemaPath: "/properties/tokenBalances",
        keyword: "properties",
        params: { error: "missing", missingProperty: "tokenBalances" },
        message: "must have property 'tokenBalances'",
      }
      if (vErrors === null) {
        vErrors = [err8]
      } else {
        vErrors.push(err8)
      }
      errors++
    }
    if (data.pageKey !== undefined) {
      if (!(typeof data.pageKey == "string")) {
        var err9 = {
          instancePath: instancePath + "/pageKey",
          schemaPath: "/optionalProperties/pageKey/type",
          keyword: "type",
          params: { type: "string", nullable: false },
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
    for (var key1 in data) {
      if (
        key1 !== "address" &&
        key1 !== "tokenBalances" &&
        key1 !== "pageKey"
      ) {
        var err10 = {
          instancePath:
            instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
          schemaPath: "",
          keyword: "properties",
          params: { error: "additional", additionalProperty: key1 },
          message: "must NOT have additional properties",
        }
        if (vErrors === null) {
          vErrors = [err10]
        } else {
          vErrors.push(err10)
        }
        errors++
      }
    }
  }
  if (!valid0) {
    var err11 = {
      instancePath: instancePath,
      schemaPath: "/properties",
      keyword: "properties",
      params: { type: "object", nullable: false },
      message: "must be object",
    }
    if (vErrors === null) {
      vErrors = [err11]
    } else {
      vErrors.push(err11)
    }
    errors++
  }
  validate59.errors = vErrors
  return errors === 0
}
exports.isValidAlchemyTokenMetadataResponse = validate60
var schema32 = {
  properties: {
    decimals: { type: "uint32", nullable: true },
    name: { type: "string" },
    symbol: { type: "string" },
    logo: { type: "string", nullable: true },
  },
  additionalProperties: false,
}
function validate60(data, valCxt) {
  "use strict"
  if (valCxt) {
    var instancePath = valCxt.instancePath
    var parentData = valCxt.parentData
    var parentDataProperty = valCxt.parentDataProperty
    var rootData = valCxt.rootData
  } else {
    var instancePath = ""
    var parentData = undefined
    var parentDataProperty = undefined
    var rootData = data
  }
  var vErrors = null
  var errors = 0
  var valid0 = false
  if (data && typeof data == "object" && !Array.isArray(data)) {
    valid0 = true
    if (data.decimals !== undefined) {
      var data0 = data.decimals
      if (
        !(
          data0 === null ||
          (typeof data0 == "number" &&
            isFinite(data0) &&
            !(data0 % 1) &&
            data0 >= 0 &&
            data0 <= 4294967295)
        )
      ) {
        var err0 = {
          instancePath: instancePath + "/decimals",
          schemaPath: "/properties/decimals/type",
          keyword: "type",
          params: { type: "uint32", nullable: true },
          message: "must be uint32 or null",
        }
        if (vErrors === null) {
          vErrors = [err0]
        } else {
          vErrors.push(err0)
        }
        errors++
      }
    } else {
      var err1 = {
        instancePath: instancePath,
        schemaPath: "/properties/decimals",
        keyword: "properties",
        params: { error: "missing", missingProperty: "decimals" },
        message: "must have property 'decimals'",
      }
      if (vErrors === null) {
        vErrors = [err1]
      } else {
        vErrors.push(err1)
      }
      errors++
    }
    if (data.name !== undefined) {
      if (!(typeof data.name == "string")) {
        var err2 = {
          instancePath: instancePath + "/name",
          schemaPath: "/properties/name/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err2]
        } else {
          vErrors.push(err2)
        }
        errors++
      }
    } else {
      var err3 = {
        instancePath: instancePath,
        schemaPath: "/properties/name",
        keyword: "properties",
        params: { error: "missing", missingProperty: "name" },
        message: "must have property 'name'",
      }
      if (vErrors === null) {
        vErrors = [err3]
      } else {
        vErrors.push(err3)
      }
      errors++
    }
    if (data.symbol !== undefined) {
      if (!(typeof data.symbol == "string")) {
        var err4 = {
          instancePath: instancePath + "/symbol",
          schemaPath: "/properties/symbol/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err4]
        } else {
          vErrors.push(err4)
        }
        errors++
      }
    } else {
      var err5 = {
        instancePath: instancePath,
        schemaPath: "/properties/symbol",
        keyword: "properties",
        params: { error: "missing", missingProperty: "symbol" },
        message: "must have property 'symbol'",
      }
      if (vErrors === null) {
        vErrors = [err5]
      } else {
        vErrors.push(err5)
      }
      errors++
    }
    if (data.logo !== undefined) {
      var data3 = data.logo
      if (!(data3 === null || typeof data3 == "string")) {
        var err6 = {
          instancePath: instancePath + "/logo",
          schemaPath: "/properties/logo/type",
          keyword: "type",
          params: { type: "string", nullable: true },
          message: "must be string or null",
        }
        if (vErrors === null) {
          vErrors = [err6]
        } else {
          vErrors.push(err6)
        }
        errors++
      }
    } else {
      var err7 = {
        instancePath: instancePath,
        schemaPath: "/properties/logo",
        keyword: "properties",
        params: { error: "missing", missingProperty: "logo" },
        message: "must have property 'logo'",
      }
      if (vErrors === null) {
        vErrors = [err7]
      } else {
        vErrors.push(err7)
      }
      errors++
    }
    for (var key0 in data) {
      if (
        key0 !== "decimals" &&
        key0 !== "name" &&
        key0 !== "symbol" &&
        key0 !== "logo"
      ) {
        var err8 = {
          instancePath:
            instancePath + "/" + key0.replace(/~/g, "~0").replace(/\//g, "~1"),
          schemaPath: "",
          keyword: "properties",
          params: { error: "additional", additionalProperty: key0 },
          message: "must NOT have additional properties",
        }
        if (vErrors === null) {
          vErrors = [err8]
        } else {
          vErrors.push(err8)
        }
        errors++
      }
    }
  }
  if (!valid0) {
    var err9 = {
      instancePath: instancePath,
      schemaPath: "/properties",
      keyword: "properties",
      params: { type: "object", nullable: false },
      message: "must be object",
    }
    if (vErrors === null) {
      vErrors = [err9]
    } else {
      vErrors.push(err9)
    }
    errors++
  }
  validate60.errors = vErrors
  return errors === 0
}
exports.isValidSwapPriceResponse = validate61
var schema33 = {
  properties: {
    chainId: { type: "uint32" },
    price: { type: "string" },
    value: { type: "string" },
    gasPrice: { type: "string" },
    gas: { type: "string" },
    estimatedGas: { type: "string" },
    protocolFee: { type: "string" },
    minimumProtocolFee: { type: "string" },
    buyTokenAddress: { type: "string" },
    buyAmount: { type: "string" },
    sellTokenAddress: { type: "string" },
    sellAmount: { type: "string" },
    sources: {
      elements: {
        properties: {
          name: { type: "string" },
          proportion: { type: "string" },
        },
        additionalProperties: true,
      },
    },
    allowanceTarget: { type: "string" },
    sellTokenToEthRate: { type: "string" },
    buyTokenToEthRate: { type: "string" },
    estimatedPriceImpact: { type: "string" },
  },
  additionalProperties: true,
}
function validate61(data, valCxt) {
  "use strict"
  if (valCxt) {
    var instancePath = valCxt.instancePath
    var parentData = valCxt.parentData
    var parentDataProperty = valCxt.parentDataProperty
    var rootData = valCxt.rootData
  } else {
    var instancePath = ""
    var parentData = undefined
    var parentDataProperty = undefined
    var rootData = data
  }
  var vErrors = null
  var errors = 0
  var valid0 = false
  if (data && typeof data == "object" && !Array.isArray(data)) {
    valid0 = true
    if (data.chainId !== undefined) {
      var data0 = data.chainId
      if (
        !(
          typeof data0 == "number" &&
          isFinite(data0) &&
          !(data0 % 1) &&
          data0 >= 0 &&
          data0 <= 4294967295
        )
      ) {
        var err0 = {
          instancePath: instancePath + "/chainId",
          schemaPath: "/properties/chainId/type",
          keyword: "type",
          params: { type: "uint32", nullable: false },
          message: "must be uint32",
        }
        if (vErrors === null) {
          vErrors = [err0]
        } else {
          vErrors.push(err0)
        }
        errors++
      }
    } else {
      var err1 = {
        instancePath: instancePath,
        schemaPath: "/properties/chainId",
        keyword: "properties",
        params: { error: "missing", missingProperty: "chainId" },
        message: "must have property 'chainId'",
      }
      if (vErrors === null) {
        vErrors = [err1]
      } else {
        vErrors.push(err1)
      }
      errors++
    }
    if (data.price !== undefined) {
      if (!(typeof data.price == "string")) {
        var err2 = {
          instancePath: instancePath + "/price",
          schemaPath: "/properties/price/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err2]
        } else {
          vErrors.push(err2)
        }
        errors++
      }
    } else {
      var err3 = {
        instancePath: instancePath,
        schemaPath: "/properties/price",
        keyword: "properties",
        params: { error: "missing", missingProperty: "price" },
        message: "must have property 'price'",
      }
      if (vErrors === null) {
        vErrors = [err3]
      } else {
        vErrors.push(err3)
      }
      errors++
    }
    if (data.value !== undefined) {
      if (!(typeof data.value == "string")) {
        var err4 = {
          instancePath: instancePath + "/value",
          schemaPath: "/properties/value/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err4]
        } else {
          vErrors.push(err4)
        }
        errors++
      }
    } else {
      var err5 = {
        instancePath: instancePath,
        schemaPath: "/properties/value",
        keyword: "properties",
        params: { error: "missing", missingProperty: "value" },
        message: "must have property 'value'",
      }
      if (vErrors === null) {
        vErrors = [err5]
      } else {
        vErrors.push(err5)
      }
      errors++
    }
    if (data.gasPrice !== undefined) {
      if (!(typeof data.gasPrice == "string")) {
        var err6 = {
          instancePath: instancePath + "/gasPrice",
          schemaPath: "/properties/gasPrice/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err6]
        } else {
          vErrors.push(err6)
        }
        errors++
      }
    } else {
      var err7 = {
        instancePath: instancePath,
        schemaPath: "/properties/gasPrice",
        keyword: "properties",
        params: { error: "missing", missingProperty: "gasPrice" },
        message: "must have property 'gasPrice'",
      }
      if (vErrors === null) {
        vErrors = [err7]
      } else {
        vErrors.push(err7)
      }
      errors++
    }
    if (data.gas !== undefined) {
      if (!(typeof data.gas == "string")) {
        var err8 = {
          instancePath: instancePath + "/gas",
          schemaPath: "/properties/gas/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err8]
        } else {
          vErrors.push(err8)
        }
        errors++
      }
    } else {
      var err9 = {
        instancePath: instancePath,
        schemaPath: "/properties/gas",
        keyword: "properties",
        params: { error: "missing", missingProperty: "gas" },
        message: "must have property 'gas'",
      }
      if (vErrors === null) {
        vErrors = [err9]
      } else {
        vErrors.push(err9)
      }
      errors++
    }
    if (data.estimatedGas !== undefined) {
      if (!(typeof data.estimatedGas == "string")) {
        var err10 = {
          instancePath: instancePath + "/estimatedGas",
          schemaPath: "/properties/estimatedGas/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err10]
        } else {
          vErrors.push(err10)
        }
        errors++
      }
    } else {
      var err11 = {
        instancePath: instancePath,
        schemaPath: "/properties/estimatedGas",
        keyword: "properties",
        params: { error: "missing", missingProperty: "estimatedGas" },
        message: "must have property 'estimatedGas'",
      }
      if (vErrors === null) {
        vErrors = [err11]
      } else {
        vErrors.push(err11)
      }
      errors++
    }
    if (data.protocolFee !== undefined) {
      if (!(typeof data.protocolFee == "string")) {
        var err12 = {
          instancePath: instancePath + "/protocolFee",
          schemaPath: "/properties/protocolFee/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err12]
        } else {
          vErrors.push(err12)
        }
        errors++
      }
    } else {
      var err13 = {
        instancePath: instancePath,
        schemaPath: "/properties/protocolFee",
        keyword: "properties",
        params: { error: "missing", missingProperty: "protocolFee" },
        message: "must have property 'protocolFee'",
      }
      if (vErrors === null) {
        vErrors = [err13]
      } else {
        vErrors.push(err13)
      }
      errors++
    }
    if (data.minimumProtocolFee !== undefined) {
      if (!(typeof data.minimumProtocolFee == "string")) {
        var err14 = {
          instancePath: instancePath + "/minimumProtocolFee",
          schemaPath: "/properties/minimumProtocolFee/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err14]
        } else {
          vErrors.push(err14)
        }
        errors++
      }
    } else {
      var err15 = {
        instancePath: instancePath,
        schemaPath: "/properties/minimumProtocolFee",
        keyword: "properties",
        params: { error: "missing", missingProperty: "minimumProtocolFee" },
        message: "must have property 'minimumProtocolFee'",
      }
      if (vErrors === null) {
        vErrors = [err15]
      } else {
        vErrors.push(err15)
      }
      errors++
    }
    if (data.buyTokenAddress !== undefined) {
      if (!(typeof data.buyTokenAddress == "string")) {
        var err16 = {
          instancePath: instancePath + "/buyTokenAddress",
          schemaPath: "/properties/buyTokenAddress/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err16]
        } else {
          vErrors.push(err16)
        }
        errors++
      }
    } else {
      var err17 = {
        instancePath: instancePath,
        schemaPath: "/properties/buyTokenAddress",
        keyword: "properties",
        params: { error: "missing", missingProperty: "buyTokenAddress" },
        message: "must have property 'buyTokenAddress'",
      }
      if (vErrors === null) {
        vErrors = [err17]
      } else {
        vErrors.push(err17)
      }
      errors++
    }
    if (data.buyAmount !== undefined) {
      if (!(typeof data.buyAmount == "string")) {
        var err18 = {
          instancePath: instancePath + "/buyAmount",
          schemaPath: "/properties/buyAmount/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err18]
        } else {
          vErrors.push(err18)
        }
        errors++
      }
    } else {
      var err19 = {
        instancePath: instancePath,
        schemaPath: "/properties/buyAmount",
        keyword: "properties",
        params: { error: "missing", missingProperty: "buyAmount" },
        message: "must have property 'buyAmount'",
      }
      if (vErrors === null) {
        vErrors = [err19]
      } else {
        vErrors.push(err19)
      }
      errors++
    }
    if (data.sellTokenAddress !== undefined) {
      if (!(typeof data.sellTokenAddress == "string")) {
        var err20 = {
          instancePath: instancePath + "/sellTokenAddress",
          schemaPath: "/properties/sellTokenAddress/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err20]
        } else {
          vErrors.push(err20)
        }
        errors++
      }
    } else {
      var err21 = {
        instancePath: instancePath,
        schemaPath: "/properties/sellTokenAddress",
        keyword: "properties",
        params: { error: "missing", missingProperty: "sellTokenAddress" },
        message: "must have property 'sellTokenAddress'",
      }
      if (vErrors === null) {
        vErrors = [err21]
      } else {
        vErrors.push(err21)
      }
      errors++
    }
    if (data.sellAmount !== undefined) {
      if (!(typeof data.sellAmount == "string")) {
        var err22 = {
          instancePath: instancePath + "/sellAmount",
          schemaPath: "/properties/sellAmount/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err22]
        } else {
          vErrors.push(err22)
        }
        errors++
      }
    } else {
      var err23 = {
        instancePath: instancePath,
        schemaPath: "/properties/sellAmount",
        keyword: "properties",
        params: { error: "missing", missingProperty: "sellAmount" },
        message: "must have property 'sellAmount'",
      }
      if (vErrors === null) {
        vErrors = [err23]
      } else {
        vErrors.push(err23)
      }
      errors++
    }
    if (data.sources !== undefined) {
      var data12 = data.sources
      var valid2 = false
      if (!valid2) {
        if (Array.isArray(data12)) {
          var valid4 = true
          var len0 = data12.length
          for (var i0 = 0; i0 < len0; i0++) {
            var data13 = data12[i0]
            var _errs13 = errors
            var valid5 = false
            if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
              valid5 = true
              if (data13.name !== undefined) {
                if (!(typeof data13.name == "string")) {
                  var err24 = {
                    instancePath: instancePath + "/sources/" + i0 + "/name",
                    schemaPath:
                      "/properties/sources/elements/properties/name/type",
                    keyword: "type",
                    params: { type: "string", nullable: false },
                    message: "must be string",
                  }
                  if (vErrors === null) {
                    vErrors = [err24]
                  } else {
                    vErrors.push(err24)
                  }
                  errors++
                }
              } else {
                var err25 = {
                  instancePath: instancePath + "/sources/" + i0,
                  schemaPath: "/properties/sources/elements/properties/name",
                  keyword: "properties",
                  params: { error: "missing", missingProperty: "name" },
                  message: "must have property 'name'",
                }
                if (vErrors === null) {
                  vErrors = [err25]
                } else {
                  vErrors.push(err25)
                }
                errors++
              }
              if (data13.proportion !== undefined) {
                if (!(typeof data13.proportion == "string")) {
                  var err26 = {
                    instancePath:
                      instancePath + "/sources/" + i0 + "/proportion",
                    schemaPath:
                      "/properties/sources/elements/properties/proportion/type",
                    keyword: "type",
                    params: { type: "string", nullable: false },
                    message: "must be string",
                  }
                  if (vErrors === null) {
                    vErrors = [err26]
                  } else {
                    vErrors.push(err26)
                  }
                  errors++
                }
              } else {
                var err27 = {
                  instancePath: instancePath + "/sources/" + i0,
                  schemaPath:
                    "/properties/sources/elements/properties/proportion",
                  keyword: "properties",
                  params: { error: "missing", missingProperty: "proportion" },
                  message: "must have property 'proportion'",
                }
                if (vErrors === null) {
                  vErrors = [err27]
                } else {
                  vErrors.push(err27)
                }
                errors++
              }
            }
            if (!valid5) {
              var err28 = {
                instancePath: instancePath + "/sources/" + i0,
                schemaPath: "/properties/sources/elements/properties",
                keyword: "properties",
                params: { type: "object", nullable: false },
                message: "must be object",
              }
              if (vErrors === null) {
                vErrors = [err28]
              } else {
                vErrors.push(err28)
              }
              errors++
            }
            var valid3 = _errs13 === errors
            if (!valid3) {
              valid4 = false
            }
          }
          valid2 = valid4
        } else {
          var err29 = {
            instancePath: instancePath + "/sources",
            schemaPath: "/properties/sources/elements",
            keyword: "elements",
            params: { type: "array", nullable: false },
            message: "must be array",
          }
          if (vErrors === null) {
            vErrors = [err29]
          } else {
            vErrors.push(err29)
          }
          errors++
        }
      }
    } else {
      var err30 = {
        instancePath: instancePath,
        schemaPath: "/properties/sources",
        keyword: "properties",
        params: { error: "missing", missingProperty: "sources" },
        message: "must have property 'sources'",
      }
      if (vErrors === null) {
        vErrors = [err30]
      } else {
        vErrors.push(err30)
      }
      errors++
    }
    if (data.allowanceTarget !== undefined) {
      if (!(typeof data.allowanceTarget == "string")) {
        var err31 = {
          instancePath: instancePath + "/allowanceTarget",
          schemaPath: "/properties/allowanceTarget/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err31]
        } else {
          vErrors.push(err31)
        }
        errors++
      }
    } else {
      var err32 = {
        instancePath: instancePath,
        schemaPath: "/properties/allowanceTarget",
        keyword: "properties",
        params: { error: "missing", missingProperty: "allowanceTarget" },
        message: "must have property 'allowanceTarget'",
      }
      if (vErrors === null) {
        vErrors = [err32]
      } else {
        vErrors.push(err32)
      }
      errors++
    }
    if (data.sellTokenToEthRate !== undefined) {
      if (!(typeof data.sellTokenToEthRate == "string")) {
        var err33 = {
          instancePath: instancePath + "/sellTokenToEthRate",
          schemaPath: "/properties/sellTokenToEthRate/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err33]
        } else {
          vErrors.push(err33)
        }
        errors++
      }
    } else {
      var err34 = {
        instancePath: instancePath,
        schemaPath: "/properties/sellTokenToEthRate",
        keyword: "properties",
        params: { error: "missing", missingProperty: "sellTokenToEthRate" },
        message: "must have property 'sellTokenToEthRate'",
      }
      if (vErrors === null) {
        vErrors = [err34]
      } else {
        vErrors.push(err34)
      }
      errors++
    }
    if (data.buyTokenToEthRate !== undefined) {
      if (!(typeof data.buyTokenToEthRate == "string")) {
        var err35 = {
          instancePath: instancePath + "/buyTokenToEthRate",
          schemaPath: "/properties/buyTokenToEthRate/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err35]
        } else {
          vErrors.push(err35)
        }
        errors++
      }
    } else {
      var err36 = {
        instancePath: instancePath,
        schemaPath: "/properties/buyTokenToEthRate",
        keyword: "properties",
        params: { error: "missing", missingProperty: "buyTokenToEthRate" },
        message: "must have property 'buyTokenToEthRate'",
      }
      if (vErrors === null) {
        vErrors = [err36]
      } else {
        vErrors.push(err36)
      }
      errors++
    }
    if (data.estimatedPriceImpact !== undefined) {
      if (!(typeof data.estimatedPriceImpact == "string")) {
        var err37 = {
          instancePath: instancePath + "/estimatedPriceImpact",
          schemaPath: "/properties/estimatedPriceImpact/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err37]
        } else {
          vErrors.push(err37)
        }
        errors++
      }
    } else {
      var err38 = {
        instancePath: instancePath,
        schemaPath: "/properties/estimatedPriceImpact",
        keyword: "properties",
        params: { error: "missing", missingProperty: "estimatedPriceImpact" },
        message: "must have property 'estimatedPriceImpact'",
      }
      if (vErrors === null) {
        vErrors = [err38]
      } else {
        vErrors.push(err38)
      }
      errors++
    }
  }
  if (!valid0) {
    var err39 = {
      instancePath: instancePath,
      schemaPath: "/properties",
      keyword: "properties",
      params: { type: "object", nullable: false },
      message: "must be object",
    }
    if (vErrors === null) {
      vErrors = [err39]
    } else {
      vErrors.push(err39)
    }
    errors++
  }
  validate61.errors = vErrors
  return errors === 0
}
exports.isValidSwapQuoteResponse = validate62
var schema34 = {
  properties: {
    chainId: { type: "uint32" },
    price: { type: "string" },
    value: { type: "string" },
    gasPrice: { type: "string" },
    gas: { type: "string" },
    estimatedGas: { type: "string" },
    protocolFee: { type: "string" },
    minimumProtocolFee: { type: "string" },
    buyTokenAddress: { type: "string" },
    buyAmount: { type: "string" },
    sellTokenAddress: { type: "string" },
    sellAmount: { type: "string" },
    sources: {
      elements: {
        properties: {
          name: { type: "string" },
          proportion: { type: "string" },
        },
        additionalProperties: true,
      },
    },
    allowanceTarget: { type: "string" },
    sellTokenToEthRate: { type: "string" },
    buyTokenToEthRate: { type: "string" },
    estimatedPriceImpact: { type: "string" },
    data: { type: "string" },
    guaranteedPrice: { type: "string" },
    to: { type: "string" },
  },
  optionalProperties: { from: { type: "string" } },
  additionalProperties: true,
}
function validate62(data, valCxt) {
  "use strict"
  if (valCxt) {
    var instancePath = valCxt.instancePath
    var parentData = valCxt.parentData
    var parentDataProperty = valCxt.parentDataProperty
    var rootData = valCxt.rootData
  } else {
    var instancePath = ""
    var parentData = undefined
    var parentDataProperty = undefined
    var rootData = data
  }
  var vErrors = null
  var errors = 0
  var valid0 = false
  if (data && typeof data == "object" && !Array.isArray(data)) {
    valid0 = true
    if (data.chainId !== undefined) {
      var data0 = data.chainId
      if (
        !(
          typeof data0 == "number" &&
          isFinite(data0) &&
          !(data0 % 1) &&
          data0 >= 0 &&
          data0 <= 4294967295
        )
      ) {
        var err0 = {
          instancePath: instancePath + "/chainId",
          schemaPath: "/properties/chainId/type",
          keyword: "type",
          params: { type: "uint32", nullable: false },
          message: "must be uint32",
        }
        if (vErrors === null) {
          vErrors = [err0]
        } else {
          vErrors.push(err0)
        }
        errors++
      }
    } else {
      var err1 = {
        instancePath: instancePath,
        schemaPath: "/properties/chainId",
        keyword: "properties",
        params: { error: "missing", missingProperty: "chainId" },
        message: "must have property 'chainId'",
      }
      if (vErrors === null) {
        vErrors = [err1]
      } else {
        vErrors.push(err1)
      }
      errors++
    }
    if (data.price !== undefined) {
      if (!(typeof data.price == "string")) {
        var err2 = {
          instancePath: instancePath + "/price",
          schemaPath: "/properties/price/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err2]
        } else {
          vErrors.push(err2)
        }
        errors++
      }
    } else {
      var err3 = {
        instancePath: instancePath,
        schemaPath: "/properties/price",
        keyword: "properties",
        params: { error: "missing", missingProperty: "price" },
        message: "must have property 'price'",
      }
      if (vErrors === null) {
        vErrors = [err3]
      } else {
        vErrors.push(err3)
      }
      errors++
    }
    if (data.value !== undefined) {
      if (!(typeof data.value == "string")) {
        var err4 = {
          instancePath: instancePath + "/value",
          schemaPath: "/properties/value/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err4]
        } else {
          vErrors.push(err4)
        }
        errors++
      }
    } else {
      var err5 = {
        instancePath: instancePath,
        schemaPath: "/properties/value",
        keyword: "properties",
        params: { error: "missing", missingProperty: "value" },
        message: "must have property 'value'",
      }
      if (vErrors === null) {
        vErrors = [err5]
      } else {
        vErrors.push(err5)
      }
      errors++
    }
    if (data.gasPrice !== undefined) {
      if (!(typeof data.gasPrice == "string")) {
        var err6 = {
          instancePath: instancePath + "/gasPrice",
          schemaPath: "/properties/gasPrice/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err6]
        } else {
          vErrors.push(err6)
        }
        errors++
      }
    } else {
      var err7 = {
        instancePath: instancePath,
        schemaPath: "/properties/gasPrice",
        keyword: "properties",
        params: { error: "missing", missingProperty: "gasPrice" },
        message: "must have property 'gasPrice'",
      }
      if (vErrors === null) {
        vErrors = [err7]
      } else {
        vErrors.push(err7)
      }
      errors++
    }
    if (data.gas !== undefined) {
      if (!(typeof data.gas == "string")) {
        var err8 = {
          instancePath: instancePath + "/gas",
          schemaPath: "/properties/gas/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err8]
        } else {
          vErrors.push(err8)
        }
        errors++
      }
    } else {
      var err9 = {
        instancePath: instancePath,
        schemaPath: "/properties/gas",
        keyword: "properties",
        params: { error: "missing", missingProperty: "gas" },
        message: "must have property 'gas'",
      }
      if (vErrors === null) {
        vErrors = [err9]
      } else {
        vErrors.push(err9)
      }
      errors++
    }
    if (data.estimatedGas !== undefined) {
      if (!(typeof data.estimatedGas == "string")) {
        var err10 = {
          instancePath: instancePath + "/estimatedGas",
          schemaPath: "/properties/estimatedGas/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err10]
        } else {
          vErrors.push(err10)
        }
        errors++
      }
    } else {
      var err11 = {
        instancePath: instancePath,
        schemaPath: "/properties/estimatedGas",
        keyword: "properties",
        params: { error: "missing", missingProperty: "estimatedGas" },
        message: "must have property 'estimatedGas'",
      }
      if (vErrors === null) {
        vErrors = [err11]
      } else {
        vErrors.push(err11)
      }
      errors++
    }
    if (data.protocolFee !== undefined) {
      if (!(typeof data.protocolFee == "string")) {
        var err12 = {
          instancePath: instancePath + "/protocolFee",
          schemaPath: "/properties/protocolFee/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err12]
        } else {
          vErrors.push(err12)
        }
        errors++
      }
    } else {
      var err13 = {
        instancePath: instancePath,
        schemaPath: "/properties/protocolFee",
        keyword: "properties",
        params: { error: "missing", missingProperty: "protocolFee" },
        message: "must have property 'protocolFee'",
      }
      if (vErrors === null) {
        vErrors = [err13]
      } else {
        vErrors.push(err13)
      }
      errors++
    }
    if (data.minimumProtocolFee !== undefined) {
      if (!(typeof data.minimumProtocolFee == "string")) {
        var err14 = {
          instancePath: instancePath + "/minimumProtocolFee",
          schemaPath: "/properties/minimumProtocolFee/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err14]
        } else {
          vErrors.push(err14)
        }
        errors++
      }
    } else {
      var err15 = {
        instancePath: instancePath,
        schemaPath: "/properties/minimumProtocolFee",
        keyword: "properties",
        params: { error: "missing", missingProperty: "minimumProtocolFee" },
        message: "must have property 'minimumProtocolFee'",
      }
      if (vErrors === null) {
        vErrors = [err15]
      } else {
        vErrors.push(err15)
      }
      errors++
    }
    if (data.buyTokenAddress !== undefined) {
      if (!(typeof data.buyTokenAddress == "string")) {
        var err16 = {
          instancePath: instancePath + "/buyTokenAddress",
          schemaPath: "/properties/buyTokenAddress/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err16]
        } else {
          vErrors.push(err16)
        }
        errors++
      }
    } else {
      var err17 = {
        instancePath: instancePath,
        schemaPath: "/properties/buyTokenAddress",
        keyword: "properties",
        params: { error: "missing", missingProperty: "buyTokenAddress" },
        message: "must have property 'buyTokenAddress'",
      }
      if (vErrors === null) {
        vErrors = [err17]
      } else {
        vErrors.push(err17)
      }
      errors++
    }
    if (data.buyAmount !== undefined) {
      if (!(typeof data.buyAmount == "string")) {
        var err18 = {
          instancePath: instancePath + "/buyAmount",
          schemaPath: "/properties/buyAmount/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err18]
        } else {
          vErrors.push(err18)
        }
        errors++
      }
    } else {
      var err19 = {
        instancePath: instancePath,
        schemaPath: "/properties/buyAmount",
        keyword: "properties",
        params: { error: "missing", missingProperty: "buyAmount" },
        message: "must have property 'buyAmount'",
      }
      if (vErrors === null) {
        vErrors = [err19]
      } else {
        vErrors.push(err19)
      }
      errors++
    }
    if (data.sellTokenAddress !== undefined) {
      if (!(typeof data.sellTokenAddress == "string")) {
        var err20 = {
          instancePath: instancePath + "/sellTokenAddress",
          schemaPath: "/properties/sellTokenAddress/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err20]
        } else {
          vErrors.push(err20)
        }
        errors++
      }
    } else {
      var err21 = {
        instancePath: instancePath,
        schemaPath: "/properties/sellTokenAddress",
        keyword: "properties",
        params: { error: "missing", missingProperty: "sellTokenAddress" },
        message: "must have property 'sellTokenAddress'",
      }
      if (vErrors === null) {
        vErrors = [err21]
      } else {
        vErrors.push(err21)
      }
      errors++
    }
    if (data.sellAmount !== undefined) {
      if (!(typeof data.sellAmount == "string")) {
        var err22 = {
          instancePath: instancePath + "/sellAmount",
          schemaPath: "/properties/sellAmount/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err22]
        } else {
          vErrors.push(err22)
        }
        errors++
      }
    } else {
      var err23 = {
        instancePath: instancePath,
        schemaPath: "/properties/sellAmount",
        keyword: "properties",
        params: { error: "missing", missingProperty: "sellAmount" },
        message: "must have property 'sellAmount'",
      }
      if (vErrors === null) {
        vErrors = [err23]
      } else {
        vErrors.push(err23)
      }
      errors++
    }
    if (data.sources !== undefined) {
      var data12 = data.sources
      var valid2 = false
      if (!valid2) {
        if (Array.isArray(data12)) {
          var valid4 = true
          var len0 = data12.length
          for (var i0 = 0; i0 < len0; i0++) {
            var data13 = data12[i0]
            var _errs13 = errors
            var valid5 = false
            if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
              valid5 = true
              if (data13.name !== undefined) {
                if (!(typeof data13.name == "string")) {
                  var err24 = {
                    instancePath: instancePath + "/sources/" + i0 + "/name",
                    schemaPath:
                      "/properties/sources/elements/properties/name/type",
                    keyword: "type",
                    params: { type: "string", nullable: false },
                    message: "must be string",
                  }
                  if (vErrors === null) {
                    vErrors = [err24]
                  } else {
                    vErrors.push(err24)
                  }
                  errors++
                }
              } else {
                var err25 = {
                  instancePath: instancePath + "/sources/" + i0,
                  schemaPath: "/properties/sources/elements/properties/name",
                  keyword: "properties",
                  params: { error: "missing", missingProperty: "name" },
                  message: "must have property 'name'",
                }
                if (vErrors === null) {
                  vErrors = [err25]
                } else {
                  vErrors.push(err25)
                }
                errors++
              }
              if (data13.proportion !== undefined) {
                if (!(typeof data13.proportion == "string")) {
                  var err26 = {
                    instancePath:
                      instancePath + "/sources/" + i0 + "/proportion",
                    schemaPath:
                      "/properties/sources/elements/properties/proportion/type",
                    keyword: "type",
                    params: { type: "string", nullable: false },
                    message: "must be string",
                  }
                  if (vErrors === null) {
                    vErrors = [err26]
                  } else {
                    vErrors.push(err26)
                  }
                  errors++
                }
              } else {
                var err27 = {
                  instancePath: instancePath + "/sources/" + i0,
                  schemaPath:
                    "/properties/sources/elements/properties/proportion",
                  keyword: "properties",
                  params: { error: "missing", missingProperty: "proportion" },
                  message: "must have property 'proportion'",
                }
                if (vErrors === null) {
                  vErrors = [err27]
                } else {
                  vErrors.push(err27)
                }
                errors++
              }
            }
            if (!valid5) {
              var err28 = {
                instancePath: instancePath + "/sources/" + i0,
                schemaPath: "/properties/sources/elements/properties",
                keyword: "properties",
                params: { type: "object", nullable: false },
                message: "must be object",
              }
              if (vErrors === null) {
                vErrors = [err28]
              } else {
                vErrors.push(err28)
              }
              errors++
            }
            var valid3 = _errs13 === errors
            if (!valid3) {
              valid4 = false
            }
          }
          valid2 = valid4
        } else {
          var err29 = {
            instancePath: instancePath + "/sources",
            schemaPath: "/properties/sources/elements",
            keyword: "elements",
            params: { type: "array", nullable: false },
            message: "must be array",
          }
          if (vErrors === null) {
            vErrors = [err29]
          } else {
            vErrors.push(err29)
          }
          errors++
        }
      }
    } else {
      var err30 = {
        instancePath: instancePath,
        schemaPath: "/properties/sources",
        keyword: "properties",
        params: { error: "missing", missingProperty: "sources" },
        message: "must have property 'sources'",
      }
      if (vErrors === null) {
        vErrors = [err30]
      } else {
        vErrors.push(err30)
      }
      errors++
    }
    if (data.allowanceTarget !== undefined) {
      if (!(typeof data.allowanceTarget == "string")) {
        var err31 = {
          instancePath: instancePath + "/allowanceTarget",
          schemaPath: "/properties/allowanceTarget/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err31]
        } else {
          vErrors.push(err31)
        }
        errors++
      }
    } else {
      var err32 = {
        instancePath: instancePath,
        schemaPath: "/properties/allowanceTarget",
        keyword: "properties",
        params: { error: "missing", missingProperty: "allowanceTarget" },
        message: "must have property 'allowanceTarget'",
      }
      if (vErrors === null) {
        vErrors = [err32]
      } else {
        vErrors.push(err32)
      }
      errors++
    }
    if (data.sellTokenToEthRate !== undefined) {
      if (!(typeof data.sellTokenToEthRate == "string")) {
        var err33 = {
          instancePath: instancePath + "/sellTokenToEthRate",
          schemaPath: "/properties/sellTokenToEthRate/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err33]
        } else {
          vErrors.push(err33)
        }
        errors++
      }
    } else {
      var err34 = {
        instancePath: instancePath,
        schemaPath: "/properties/sellTokenToEthRate",
        keyword: "properties",
        params: { error: "missing", missingProperty: "sellTokenToEthRate" },
        message: "must have property 'sellTokenToEthRate'",
      }
      if (vErrors === null) {
        vErrors = [err34]
      } else {
        vErrors.push(err34)
      }
      errors++
    }
    if (data.buyTokenToEthRate !== undefined) {
      if (!(typeof data.buyTokenToEthRate == "string")) {
        var err35 = {
          instancePath: instancePath + "/buyTokenToEthRate",
          schemaPath: "/properties/buyTokenToEthRate/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err35]
        } else {
          vErrors.push(err35)
        }
        errors++
      }
    } else {
      var err36 = {
        instancePath: instancePath,
        schemaPath: "/properties/buyTokenToEthRate",
        keyword: "properties",
        params: { error: "missing", missingProperty: "buyTokenToEthRate" },
        message: "must have property 'buyTokenToEthRate'",
      }
      if (vErrors === null) {
        vErrors = [err36]
      } else {
        vErrors.push(err36)
      }
      errors++
    }
    if (data.estimatedPriceImpact !== undefined) {
      if (!(typeof data.estimatedPriceImpact == "string")) {
        var err37 = {
          instancePath: instancePath + "/estimatedPriceImpact",
          schemaPath: "/properties/estimatedPriceImpact/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err37]
        } else {
          vErrors.push(err37)
        }
        errors++
      }
    } else {
      var err38 = {
        instancePath: instancePath,
        schemaPath: "/properties/estimatedPriceImpact",
        keyword: "properties",
        params: { error: "missing", missingProperty: "estimatedPriceImpact" },
        message: "must have property 'estimatedPriceImpact'",
      }
      if (vErrors === null) {
        vErrors = [err38]
      } else {
        vErrors.push(err38)
      }
      errors++
    }
    if (data.data !== undefined) {
      if (!(typeof data.data == "string")) {
        var err39 = {
          instancePath: instancePath + "/data",
          schemaPath: "/properties/data/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err39]
        } else {
          vErrors.push(err39)
        }
        errors++
      }
    } else {
      var err40 = {
        instancePath: instancePath,
        schemaPath: "/properties/data",
        keyword: "properties",
        params: { error: "missing", missingProperty: "data" },
        message: "must have property 'data'",
      }
      if (vErrors === null) {
        vErrors = [err40]
      } else {
        vErrors.push(err40)
      }
      errors++
    }
    if (data.guaranteedPrice !== undefined) {
      if (!(typeof data.guaranteedPrice == "string")) {
        var err41 = {
          instancePath: instancePath + "/guaranteedPrice",
          schemaPath: "/properties/guaranteedPrice/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err41]
        } else {
          vErrors.push(err41)
        }
        errors++
      }
    } else {
      var err42 = {
        instancePath: instancePath,
        schemaPath: "/properties/guaranteedPrice",
        keyword: "properties",
        params: { error: "missing", missingProperty: "guaranteedPrice" },
        message: "must have property 'guaranteedPrice'",
      }
      if (vErrors === null) {
        vErrors = [err42]
      } else {
        vErrors.push(err42)
      }
      errors++
    }
    if (data.to !== undefined) {
      if (!(typeof data.to == "string")) {
        var err43 = {
          instancePath: instancePath + "/to",
          schemaPath: "/properties/to/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err43]
        } else {
          vErrors.push(err43)
        }
        errors++
      }
    } else {
      var err44 = {
        instancePath: instancePath,
        schemaPath: "/properties/to",
        keyword: "properties",
        params: { error: "missing", missingProperty: "to" },
        message: "must have property 'to'",
      }
      if (vErrors === null) {
        vErrors = [err44]
      } else {
        vErrors.push(err44)
      }
      errors++
    }
    if (data.from !== undefined) {
      if (!(typeof data.from == "string")) {
        var err45 = {
          instancePath: instancePath + "/from",
          schemaPath: "/optionalProperties/from/type",
          keyword: "type",
          params: { type: "string", nullable: false },
          message: "must be string",
        }
        if (vErrors === null) {
          vErrors = [err45]
        } else {
          vErrors.push(err45)
        }
        errors++
      }
    }
  }
  if (!valid0) {
    var err46 = {
      instancePath: instancePath,
      schemaPath: "/properties",
      keyword: "properties",
      params: { type: "object", nullable: false },
      message: "must be object",
    }
    if (vErrors === null) {
      vErrors = [err46]
    } else {
      vErrors.push(err46)
    }
    errors++
  }
  validate62.errors = vErrors
  return errors === 0
}
