import React, { ReactElement } from "react"

type SharedToggleSwitchRowProps = {
  title: string
  component: () => ReactElement
}

export default function SharedToggleSwitchRow(
  props: SharedToggleSwitchRowProps
): ReactElement {
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
            color: var(--white);
            font-size: 14px;
            font-weight: 500;
            line-height: 20px;
          }
        `}
      </style>
    </div>
  )
}
