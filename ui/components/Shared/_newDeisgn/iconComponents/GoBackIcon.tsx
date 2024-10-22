import React, { CSSProperties } from "react"
import { Link } from "react-router-dom"

const GoBackIcon = ({
  width = 16,
  height = 17,
  fillColor = `var(--primary-text)`,
  style = {},
  linkTo = "-1",
}: {
  width?: number
  height?: number
  fillColor?: string
  style?: CSSProperties
  linkTo?:
    | {
        pathname: string
        search: string
        hash: string
        state: unknown
      }
    | string
}) => {
  return (
    <Link to={linkTo}>
      <div role="button" aria-label="back-icon" style={style}>
        <svg
          aria-label="back-icon"
          width={width}
          height={height}
          viewBox="0 0 16 17"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M16 7.5H3.83L9.42 1.91L8 0.5L0 8.5L8 16.5L9.41 15.09L3.83 9.5H16V7.5Z"
            fill={fillColor}
          />
        </svg>
      </div>
    </Link>
  )
}

export default GoBackIcon
