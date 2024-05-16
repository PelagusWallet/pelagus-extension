import AjvJTD from "ajv/dist/jtd"
import AjvJSON from "ajv"
import standaloneCode from "ajv/dist/standalone"
import { writeFileSync } from "fs"
import path from "path"
import { schema } from "@uniswap/token-lists"

import { metadataJTD } from "./lib/validate/erc721"

const ajvJTD = new AjvJTD({
  allErrors: true,
  code: { source: true, es5: true },
}).addSchema(metadataJTD, "isValidMetadata")

const ajvJSON = new AjvJSON({
  allErrors: true,
  code: { source: true },
  formats: { "date-time": true, uri: true },
}).addSchema(schema, "isValidUniswapTokenListResponse")

const jtdModuleCode = standaloneCode(ajvJTD).replace(
  '/*# sourceURL="https://uniswap.org/tokenlist.schema.json" */',
  ""
)
const jsonModuleCode = standaloneCode(ajvJSON).replace(
  '/*# sourceURL="https://uniswap.org/tokenlist.schema.json" */',
  ""
)

writeFileSync(
  path.join(__dirname, "/lib/validate/jtd-validators.js"),
  jtdModuleCode
)

writeFileSync(
  path.join(__dirname, "/lib/validate/json-validators.js"),
  jsonModuleCode
)
