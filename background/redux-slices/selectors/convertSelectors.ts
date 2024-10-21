import { createSelector } from "@reduxjs/toolkit"
import { isUtxoAccountTypeGuard } from "@pelagus/pelagus-ui/utils/accounts"
import { RootState } from "../index"

export const selectConvertAssetQuaiAcc = createSelector(
  (state: RootState) => state.convertAssets,
  (convertAssets) => {
    const convertedAssetsFrom = convertAssets.from
    const convertedAssetsTo = convertAssets.to

    if (convertedAssetsFrom && !isUtxoAccountTypeGuard(convertedAssetsFrom)) {
      return convertedAssetsFrom
    }

    if (convertedAssetsTo && !isUtxoAccountTypeGuard(convertedAssetsTo)) {
      return convertedAssetsTo
    }

    return null
  }
)
