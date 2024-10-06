import React, { CSSProperties } from "react"

const GoForwardMenuIcon = ({
  width = 6,
  height = 11,
  fillColor = "#19191A",
  style = {},
  onClick = () => {},
}: {
  width?: number
  height?: number
  fillColor?: string
  style?: CSSProperties
  onClick?: () => void
}) => {
  return (
    <div
      role="button"
      aria-label="forward-icon"
      style={style}
      onClick={onClick}
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 6 11"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1 9.5L4.29289 6.20711C4.68342 5.81658 4.68342 5.18342 4.29289 4.79289L1 1.5"
          stroke={fillColor}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default GoForwardMenuIcon
