import { BackgroundDispatch, RootState } from "@pelagus/pelagus-background"
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncifyFn<K> = K extends (...args: any[]) => any
  ? (...args: Parameters<K>) => Promise<ReturnType<K>>
  : never

export const useBackgroundDispatch = (): AsyncifyFn<BackgroundDispatch> =>
  useDispatch<BackgroundDispatch>() as AsyncifyFn<BackgroundDispatch>

export const useBackgroundSelector: TypedUseSelectorHook<RootState> =
  useSelector
