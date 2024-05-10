import React, { ChangeEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useDebounce } from "../../hooks"

interface AccountsSearchBarProps {
  searchAccountsValue: string
  setSearchAccountsValue: React.Dispatch<React.SetStateAction<string>>
}
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const AccountsSearchBar = ({
  searchAccountsValue,
  setSearchAccountsValue,
}: AccountsSearchBarProps) => {
  const { t } = useTranslation("translation", { keyPrefix: "drawers" })

  const [debouncedSearchValue, setDebouncedSearchValue] = useDebounce(
    searchAccountsValue,
    800
  )
  const onChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setDebouncedSearchValue(e.target.value)
  }

  useEffect(() => {
    setSearchAccountsValue(debouncedSearchValue)
  }, [debouncedSearchValue, setSearchAccountsValue])

  return (
    <>
      <div className="search_wrap">
        <input
          type="text"
          className="search_input"
          placeholder={t("accountSearchBar.placeholder")}
          spellCheck={false}
          onChange={onChangeHandler}
        />
        <span className="icon_search" />
      </div>

      <style jsx>
        {`
          .search_wrap {
            display: flex;
            position: relative;
          }
          .search_input {
            font-size: 14px;
            font-weight: 500;
            width: 100%;
            border-radius: 4px;
            border: 1px solid #a2a2a2;
            padding: 6px 36px;
            box-sizing: border-box;
            color: var(--white);
          }

          .search_input::placeholder {
            color: var(--white);
          }

          .icon_search {
            background: url("./images/icons/m/search.svg");
            background-size: 18px 18px;
            width: 18px;
            height: 18px;
            position: absolute;
            left: 13px;
            top: 50%;
            transform: translateY(-50%);
          }
        `}
      </style>
    </>
  )
}

export default AccountsSearchBar
