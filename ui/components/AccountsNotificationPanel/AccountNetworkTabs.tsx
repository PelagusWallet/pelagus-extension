import React from "react"

interface AccountNetworkTabsProps {
  selectedNetwork: NetworkInformation
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AccountNetworkTabs = ({ selectedNetwork }: AccountNetworkTabsProps) => {
  return (
    <>
      <div className="button_wrapper">
        <button type="button" className="quai">
          Quai Account
        </button>
        <button type="button" className="qi">
          Qi Wallet
        </button>
      </div>
      <style jsx>
        {`
          .button_wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.2s;
            font-size: 16px;
            font-weight: 500;
            line-height: 28px;
            color: var(--white);
          }
          .quai {
            text-align: center;
            flex-grow: 1;
            border-bottom: 4px solid var(--white);
          }
          .qi {
            text-align: center;
            flex-grow: 1;
            border-bottom: 4px solid var(--green-95);
          }

          button:hover {
            opacity: 0.6;
          }
        `}
      </style>
    </>
  )
}

export default AccountNetworkTabs
