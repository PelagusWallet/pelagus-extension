import React, { ReactElement } from "react"

export default function SharedORDivider(): ReactElement {
  return (
    <>
      <div className="custom-or-divider">OR</div>
      <style jsx>
        {`
          .custom-or-divider {
            display: flex;
            align-items: center;
            font-size: 12px;
            color: var(--green-80);
            margin: 24px 0;
          }

          .custom-or-divider::before,
          .custom-or-divider::after {
            flex: 1;
            content: "";
            height: 1px;
            background-color: var(--green-80);
          }

          .custom-or-divider::before {
            margin: 5px 5px 5px 0;
          }

          .custom-or-divider::after {
            margin: 5px 0 5px 5px;
          }
        `}
      </style>
    </>
  )
}
