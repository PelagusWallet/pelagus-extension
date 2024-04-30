import React, { ReactElement } from "react"

export default function SharedToggleSwitchRow(props: {
  title: string
  component: () => ReactElement
}): ReactElement {
  const { title, component } = props

  return (
    <div className="row">
      <div className="left">{title}</div>
      <div className="right">{component()}</div>
      <style jsx>
        {`
          .row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: var(--green-20);
            font-size: 14px;
            font-weight: 500;
            line-height: 20px;
          }
        `}
      </style>
    </div>
  )
}
