import React, { ReactElement } from "react"
import classNames from "classnames"
import { AccountCategoriesEnum } from "../../utils/enum/accountsEnum"

const SelectAccountCategoryTabs = ({
  accountCategory,
  setAccountCategory,
}: {
  accountCategory: AccountCategoriesEnum
  setAccountCategory: React.Dispatch<
    React.SetStateAction<AccountCategoriesEnum>
  >
}): ReactElement => {
  return (
    <>
      <div className="button_wrapper">
        <button
          type="button"
          className={classNames("quai", {
            active: accountCategory === AccountCategoriesEnum.quai,
          })}
          onClick={() => setAccountCategory(AccountCategoriesEnum.quai)}
        >
          {AccountCategoriesEnum.quai}
        </button>
        <button
          type="button"
          className={classNames("quai", {
            active: accountCategory === AccountCategoriesEnum.qi,
          })}
          onClick={() => setAccountCategory(AccountCategoriesEnum.qi)}
        >
          {AccountCategoriesEnum.qi}
        </button>
      </div>
      <style jsx>
        {`
          .button_wrapper {
            position: relative;
            margin: 0 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: color 0.2s;
            font-size: 16px;
            font-weight: 500;
            line-height: 24px;
            color: var(--secondary-text);
          }

          .button_wrapper::after {
            content: "";
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 2px;
            background: var(--secondary-bg);
          }

          .quai,
          .qi {
            position: relative;
            z-index: 1;
            padding: 5px 16px;
          }

          .active {
            color: var(--primary-text);
            border-bottom: 3px solid var(--accent-color);
          }
        `}
      </style>
    </>
  )
}

export default SelectAccountCategoryTabs
