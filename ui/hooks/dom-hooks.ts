import localStorageShim from "@pelagus/pelagus-background/utils/local-storage-shim"
import {
  RefObject,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react"

export const useOnClickOutside = <T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void
): void => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref?.current
      if (!el || el.contains((event?.target as Node) || null)) {
        return
      }

      handler(event) // Call the handler only if the click is outside of the element passed.
    }

    document.addEventListener("mousedown", listener)
    document.addEventListener("touchstart", listener)

    return () => {
      document.removeEventListener("mousedown", listener)
      document.removeEventListener("touchstart", listener)
    }
  }, [ref, handler]) // Reload only if ref or handler changes
}

/**
 * Hook that takes any piece of content that at times may need to be updated in
 * a delayed fashion. As long as `delayCondition` is `false`, updates to the
 * passed content are returned immediately. If `delayCondition` is `true`,
 * updates to the passed content are unchanged for an additional `delayMs`,
 * then returned.
 */
export function useDelayContentChange<T>(
  storedContent: T,
  delayCondition: boolean,
  delayMs: number
): T {
  const [delayedContent, setDelayedContent] = useState(storedContent)
  const delayedContentUpdateTimeout = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (typeof delayedContentUpdateTimeout.current !== "undefined") {
      clearTimeout(delayedContentUpdateTimeout.current)
    }

    // If the delay condition is true, update the display element after
    // delayMs. Otherwise, update it immediately.
    if (delayCondition) {
      delayedContentUpdateTimeout.current = window.setTimeout(() => {
        setDelayedContent(storedContent)
        delayedContentUpdateTimeout.current = undefined
      }, delayMs)
    } else {
      setDelayedContent(storedContent)
    }
  }, [delayCondition, delayMs, storedContent])

  if (!delayCondition) {
    return storedContent
  }

  return delayedContent
}

function debounce<T>(setStateFn: (V: T) => void, ms: number) {
  let timeout: NodeJS.Timer

  return (value: T) => {
    clearTimeout(timeout)

    timeout = setTimeout(() => {
      setStateFn(value)
    }, ms)
  }
}

export const useDebounce = <T>(initial: T, wait = 300): [T, (v: T) => void] => {
  const [state, setState] = useState(initial)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceCallback = useCallback(
    debounce((prop: T) => setState(prop), wait),
    [debounce, wait]
  )

  const setDebouncedState = (debounced: T) => {
    debounceCallback(debounced)
  }

  return [state, setDebouncedState]
}

export const setLocalStorageItem = (
  key: string,
  value: string
): Promise<void> => localStorageShim.setItem(key, value)

export const getLocalStorageItem = async (
  key: string,
  defaultValue: string
): Promise<string> => (await localStorageShim.getItem(key)) || defaultValue

export function useLocalStorage(
  key: string,
  initialValue: string
): [string, React.Dispatch<React.SetStateAction<string>>] {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    const initializeValue = async () => {
      const storedValue = await getLocalStorageItem(key, initialValue)
      setValue(storedValue)
    }
    initializeValue()
  }, [key, initialValue])

  useEffect(() => {
    const storeValue = async () => {
      await setLocalStorageItem(key, value)
    }
    storeValue()
  }, [key, value])

  return [value, setValue]
}

export function useIntersectionObserver<T extends HTMLElement>(
  callback: IntersectionObserverCallback,
  options?: { threshold: number }
): RefObject<T> {
  const ref = useRef<T>(null)
  const observer = useMemo(
    () => new IntersectionObserver(callback, options),
    [callback, options]
  )

  useEffect(() => {
    const element = ref.current
    if (element) {
      observer.observe(ref.current)
    }
    return () => {
      if (element) observer.unobserve(element)
    }
  }, [observer])

  return ref
}
