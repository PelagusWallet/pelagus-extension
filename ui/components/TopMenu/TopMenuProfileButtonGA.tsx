import { selectCurrentAccountTotal } from "@pelagus/pelagus-background/redux-slices/selectors"
import { setSnackbarMessage } from "@pelagus/pelagus-background/redux-slices/ui"
import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { truncateAddress } from "@pelagus/pelagus-background/lib/utils"
import { useBackgroundSelector } from "../../hooks"

export default function TopMenuProfileButtonGA(props: {
  onClick?: () => void
}): ReactElement {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const {
    name,
    avatarURL,
    address = "",
    shortName = "",
  } = useBackgroundSelector(selectCurrentAccountTotal) ?? {}

  const { onClick } = props

  const handleClick = () => {
    onClick?.()
  }

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    dispatch(setSnackbarMessage(t("topMenu.addressCopiedMsg")))
  }

  if (!address) {
    return <></>
  }

  return (
    <div className="profile_wrapper" data-testid="top_menu_profile_button">
      <button className="profile_button" type="button" onClick={handleClick}>
        <div className="avatar" />
        <span className="account_info_label ellipsis">{shortName || name}</span>
        <span className="icon_chevron_down" />
      </button>
      <button
        aria-label="tooltip_icon"
        type="button"
        onClick={copyAddress}
        className="address_wrapper"
      >
        <span className="address">{truncateAddress(address)}</span>
        <span className="tooltip_icon" />
      </button>
      <style jsx>
        {`
          .profile_wrapper {
            display: flex;
            flex-grow: 1;
            flex-direction: column;
            align-items: center;
            gap: 3px;
          }

          .profile_button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            user-select: none;
            padding: 3px 21px;
            border: 1px solid var(--green-95);
            border-radius: 8px;
            box-sizing: border-box;
            width: 100%;
          }

          .avatar {
            border-radius: 50%;
            width: 14px;
            height: 14px;
            background: var(--green-95)
              url("${avatarURL ?? "./images/portrait.png"}");
            background-size: cover;
            flex-shrink: 0;
          }

          .account_info_label {
            color: black;
            font-weight: 500;
            font-size: 14px;
            line-height: 20px;
            max-width: 62px;
          }

          .icon_chevron_down {
            flex-shrink: 0;
            mask-image: url("./images/chevron_down.svg");
            mask-size: 11px 7px;
            width: 11px;
            height: 7px;
            background-color: black;
          }

          .address_wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }

          .address {
            color: var(--green-60);
            font-weight: 500;
            font-size: 12px;
            line-height: 18px;
          }

          .tooltip_icon {
            flex-shrink: 0;
            mask-image: url("./images/copy.svg");
            mask-size: 14px 14px;
            width: 14px;
            height: 14px;
            background-color: var(--green-60);
          }
        `}
      </style>
    </div>
  )
}
