import React, { ReactElement } from "react"

interface SharedProgressBarProps {
  progress: number // 0 to 100
  height?: number
  color?: string
  backgroundColor?: string
  className?: string
}

export default function SharedProgressBar({
  progress,
  height = 4,
  color = "var(--trophy-gold)",
  backgroundColor = "var(--green-80)",
  className = "",
}: SharedProgressBarProps): ReactElement {
  return (
    <div className={`progress_bar_container ${className}`}>
      <div className="progress_bar" style={{ width: `${progress}%` }} />
      <style jsx>{`
        .progress_bar_container {
          width: 100%;
          height: ${height}px;
          background-color: ${backgroundColor};
          border-radius: ${height}px;
          overflow: hidden;
        }
        .progress_bar {
          height: 100%;
          background-color: ${color};
          transition: width 0.3s ease-in-out;
        }
      `}</style>
    </div>
  )
}
