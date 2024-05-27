import React, { ReactElement } from "react"
import SharedBackButton from "./SharedBackButton"

export default function SharedPageHeader({
  children,
  withoutBackText,
  backPath,
}: {
  children: React.ReactNode
  withoutBackText?: boolean
  backPath?: string
}): ReactElement {
  return (
    <div className="header_wrap">
      <SharedBackButton withoutBackText={withoutBackText} path={backPath} />
      <h1>{children}</h1>
      <style jsx>{`
        h1 {
          font-size: 22px;
          font-weight: 500;
          line-height: 32px;
          padding: 0;
          margin: -5px 0 0 0;
        }
        .header_wrap {
          display: flex;
          flex-direction: ${withoutBackText ? "row" : "column"};
          ${withoutBackText && "gap: 8px;"};
          margin-top: 25px;
        }
      `}</style>
    </div>
  )
}
