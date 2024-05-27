import { useRef, useEffect, useState, useCallback } from "react"

/**
 * Useful when checking if a component is still mounted after an asynchronous
 * operation ends to prevent memory leaks
 */
export function useIsMounted(): React.MutableRefObject<boolean> {
  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return mountedRef
}

/**
 * Runs a callback on mount, if the callback returns a function,
 * it will be called on unmount
 */
export function useOnMount<Fn extends (...args: unknown[]) => unknown>(
  callback: Fn
): void {
  const callbackRef = useRef(callback)

  useEffect(() => {
    const result = callbackRef.current()

    return () => {
      if (typeof result === "function") {
        result()
      }
    }
  }, [])
}

/**
 * Useful for "batching" state changes, Similar API to the old Component.setState
 */
export function useSetState<S extends Record<string, unknown>>(
  state: S
): readonly [S, typeof setter] {
  const [value, setValue] = useState<S>(state)

  const setter = useCallback(
    <K extends keyof S>(
      newValue: ((prev: Readonly<S>) => S) | (Pick<S, K> | S)
    ) =>
      setValue((prevState) => {
        if (typeof newValue === "function") {
          return newValue(prevState)
        }

        return { ...prevState, ...newValue }
      }),
    []
  )

  return [value, setter] as const
}

export function useRunOnFirstRender(func: () => void): void {
  const isFirst = useRef(true)

  if (isFirst.current) {
    isFirst.current = false
    func()
  }
}
