import React, { CSSProperties } from "react"

const SendIcon = ({
  width = 10,
  height = 10,
  fillColor = `var(--primary-text)`,
  style = {},
}: {
  width?: number
  height?: number
  fillColor?: string
  style?: CSSProperties
}) => {
  return (
    <div style={style}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 10 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.2154 2.29692C8.37003 2.45155 8.4569 2.66127 8.4569 2.87994C8.4569 3.09862 8.37003 3.30834 8.2154 3.46296L1.92965 9.74872C1.77502 9.90334 1.56531 9.99021 1.34663 9.99021C1.12796 9.99021 0.918235 9.90334 0.763608 9.74872C0.608981 9.59409 0.522113 9.38437 0.522113 9.16569C0.522113 8.94702 0.608981 8.7373 0.763608 8.58267L7.04858 2.2977C7.20321 2.14307 7.41293 2.0562 7.6316 2.0562C7.85028 2.0562 8.06078 2.14229 8.2154 2.29692Z"
          fill={fillColor}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.67503 1.02138C8.8903 1.02393 9.09604 1.11059 9.24827 1.26282C9.4005 1.41505 9.48715 1.62078 9.48971 1.83606L9.55034 6.97442C9.55013 7.19127 9.46449 7.39931 9.31199 7.55347C9.15948 7.70764 8.95238 7.79551 8.73554 7.79807C8.51871 7.80062 8.30959 7.71765 8.15349 7.56713C7.9974 7.4166 7.90688 7.21064 7.90156 6.99385L7.85025 2.66084L3.51723 2.60953C3.40807 2.60964 3.29997 2.58807 3.19921 2.54607C3.09845 2.50407 3.00703 2.44249 2.93026 2.36488C2.85349 2.28727 2.79289 2.19519 2.75198 2.09399C2.71108 1.99278 2.69067 1.88445 2.69196 1.7753C2.69325 1.66614 2.7162 1.55833 2.75948 1.45811C2.80276 1.35789 2.86551 1.26727 2.94409 1.19149C3.02267 1.11572 3.11551 1.0563 3.21724 1.01669C3.31896 0.977082 3.42754 0.958064 3.53667 0.960744L8.67503 1.02138Z"
          fill={fillColor}
        />
      </svg>
    </div>
  )
}

export default SendIcon