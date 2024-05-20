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
  logoURL: string
  symbol: string
}

// Passes IPFS and Arweave through HTTP gateway
function getAsHttpURL(anyURL: string) {
  let httpURL = anyURL
  try {
    httpURL = storageGatewayURL(anyURL).href
  } catch (err) {
    httpURL = ""
  }
  return httpURL
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
    if (!visible || !logoURL) {
      return
    }

    const isIpfsURL = /^ipfs:/.test(logoURL)
    const httpURL = getAsHttpURL(logoURL)

    const img = new Image()

    img.onerror = () => {
      if (isIpfsURL) {
        fetch(httpURL).then(async (response) => {
          if (
            response.ok &&
            response.headers.get("content-type") === "text/html"
          ) {
            const prefix = "data:image/svg+xml;base64,"
            const base64URI = Buffer.from(
              await response.arrayBuffer()
            ).toString("base64")

            setImageURL(prefix + base64URI)
          } else {
            throw new Error("INVALID_RESPONSE")
          }
        })
      }
    }
    img.onload = () => {
      setImageURL(img.src)
    }
    img.src = httpURL
  }, [visible, logoURL])

  return (
    <div
      ref={containerRef}
      className={classNames("token_icon_wrap", sizeClass)}
      role="img"
    >
      <div
        role="presentation"
        className={classNames("token_icon_fallback", sizeClass)}
      >
        {(symbol?.[0] ?? "?").toUpperCase()}
      </div>
      <style jsx>
        {`
          .token_icon_wrap {
            width: 40px;
            height: 40px;
            border-radius: 80px;
            border: 1px solid var(--disabled);
            overflow: hidden;
            background-color: var(--castle-black);
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
          background-color: var(--castle-black);
          display: flex;
          align-items: center;
          justify-content: center;
          background: url("${imageURL}");
          background-size: cover;
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
  logoURL: null,
  symbol: "QUAI",
}
