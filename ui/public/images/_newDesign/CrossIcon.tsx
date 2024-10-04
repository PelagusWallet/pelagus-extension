import React, { CSSProperties } from "react"

const CrossIcon = ({
  width = 14,
  height = 15,
  fillColor = "#7C7C83",
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
    <div role="button" aria-label="cross-icon" style={style} onClick={onClick}>
      <svg
        aria-label="cross-icon"
        width={width}
        height={height}
        viewBox="0 0 14 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0.374245 0.874246C-0.124749 1.37324 -0.124748 2.18227 0.374246 2.68126L5.19299 7.50001L0.37426 12.3187C-0.124734 12.8177 -0.124734 13.6268 0.37426 14.1258C0.873255 14.6247 1.68229 14.6247 2.18128 14.1258L7.00001 9.30703L11.8187 14.1257C12.3177 14.6247 13.1267 14.6247 13.6257 14.1257C14.1247 13.6267 14.1247 12.8177 13.6257 12.3187L8.80703 7.50001L13.6257 2.68131C14.1247 2.18231 14.1247 1.37328 13.6257 0.874287C13.1267 0.375293 12.3177 0.375293 11.8187 0.874287L7.00001 5.69299L2.18126 0.874246C1.68227 0.375251 0.87324 0.375251 0.374245 0.874246Z"
          fill={fillColor}
        />
      </svg>
    </div>
  )
}

export default CrossIcon
