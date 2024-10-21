import React from "react"
import InfoIcon from "../iconComponents/InfoIcon"

const SharedInfoTab = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <div className="tab-wrapper">
        <InfoIcon />
        {children}
      </div>
      <style jsx>{`
        .tab-wrapper {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          padding: 12px;
          border: 1.5px solid var(--accent-color);
          border-radius: 4px;
          background: rgba(23, 117, 228, 0.2);
        }
      `}</style>
    </>
  )
}

export default SharedInfoTab
