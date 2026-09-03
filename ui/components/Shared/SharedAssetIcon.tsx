import React, {
  ReactElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { storageGatewayURL } from "@pelagus/pelagus-background/lib/storage-gateway"
import classNames from "classnames"

type Props = {
  size: "small" | "medium" | "large" | number
  logoURL?: string
  symbol: string
}

// Passes IPFS and Arweave through HTTP gateway
function getAsHttpURL(anyURL: string): string {
  try {
    const resolvedURL = storageGatewayURL(anyURL)
    const isAllowedProtocol = [
      "http:",
      "https:",
      "chrome-extension:",
      "moz-extension:",
    ].includes(resolvedURL.protocol)

    return isAllowedProtocol ? resolvedURL.href : ""
  } catch (err) {
    return ""
  }
}

type TypedIntersectionObserverEntry<T extends Element> =
  IntersectionObserverEntry & {
    target: T
  }

function useIntersectionObserver<T extends React.RefObject<HTMLElement>>(
  ref: T,
  callback: (
    element: TypedIntersectionObserverEntry<
      T extends React.RefObject<infer U> ? U : never
    >
  ) => void,
  options: IntersectionObserverInit
) {
  const callbackRef = useRef(callback)
  const [obs] = useState(
    () =>
      new IntersectionObserver(([element]) => {
        callbackRef.current(
          element as TypedIntersectionObserverEntry<
            T extends React.RefObject<infer U> ? U : never
          >
        )
      }, options)
  )

  useLayoutEffect(() => {
    const target = ref.current

    if (target) {
      obs.observe(ref.current)
    }

    return () => {
      if (target) obs.unobserve(target)
    }
  }, [ref, obs])
}

export default function SharedAssetIcon(props: Props): ReactElement {
  const { size, logoURL, symbol } = props

  const [imageURL, setImageURL] = useState("")
  const [visible, setIsVisible] = useState(false)

  const sizeClass = typeof size === "string" ? size : "custom_size"

  const containerRef = useRef<HTMLDivElement>(null)

  useIntersectionObserver(
    containerRef,
    (entry) => {
      if (entry.isIntersecting) {
        setIsVisible(true)
      }
    },
    { threshold: 0.01, root: null, rootMargin: "50px 0px 50px 0px" }
  )

  useEffect(() => {
    setImageURL("")

    if (!visible || !logoURL) {
      return undefined
    }

    const httpURL = getAsHttpURL(logoURL)
    if (!httpURL) return undefined

    const img = new Image()
    let cancelled = false

    img.onerror = () => {
      if (!cancelled) setImageURL("")
    }
    img.onload = () => {
      if (!cancelled) setImageURL(img.src)
    }
    img.src = httpURL

    return () => {
      cancelled = true
      img.onerror = null
      img.onload = null
    }
  }, [visible, logoURL])

  return (
    <div
      ref={containerRef}
      className={classNames("token_icon_wrap", sizeClass)}
      role="img"
      aria-label={`${symbol || "Unknown"} asset`}
    >
      {imageURL ? (
        <img
          className="token_icon"
          src={imageURL}
          alt=""
          role="presentation"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          role="presentation"
          className={classNames("token_icon_fallback", sizeClass)}
        >
          {(symbol?.[0] ?? "?").toUpperCase()}
        </div>
      )}
      <style jsx>
        {`
          .token_icon_wrap {
            width: 40px;
            height: 40px;
            border-radius: 80px;
            border: none;
            overflow: hidden;
            background-color: var(--secondary-bg);
            flex-shrink: 0;
          }
          .token_icon_fallback {
            width: 100%;
            height: 100%;
            color: var(--green-60);
            font-weight: 900;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .medium .token_icon_fallback {
            margin-top: 1px;
          }
          .small {
            width: 32px;
            height: 32px;
          }
          .large {
            width: 48px;
            height: 48px;
          }
        `}
      </style>
      <style jsx>{`
        ${typeof size === "number"
          ? `.token_icon_wrap.custom_size {
              width: ${size}px;
              height: ${size}px;
            }`
          : ""}
        .token_icon {
          width: 100%;
          height: 100%;
          background-color: var(--secondary-bg);
          display: block;
          object-fit: cover;
          animation: fadein 130ms ease-out forwards;
        }

        @keyframes fadein {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

SharedAssetIcon.defaultProps = {
  size: "medium",
  logoURL: undefined,
  symbol: "QUAI",
}
