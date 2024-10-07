import React from "react"
import ErrorIcon from "../iconComponents/ErrorIcon"

const SharedErrorLabel = ({ title }: { title: string }) => {
  return (
    <>
      <div className="shared-error-label">
        <ErrorIcon />
        <h3 className="title">{title}</h3>
      </div>
      <style jsx>{`
        .shared-error-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 8px 0;
        }
        .title {
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          margin: 0;
          color: var(--error-color);
        }
      `}</style>
    </>
  )
}

export default SharedErrorLabel
