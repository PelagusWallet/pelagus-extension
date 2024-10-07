import React from "react"
import { setSnackbarConfig } from "@pelagus/pelagus-background/redux-slices/ui"
import SharedDropdown from "../../../../SharedDropDown"
import { useBackgroundDispatch } from "../../../../../../hooks"

const QiAccountOptionMenu = ({ paymentCode }: { paymentCode: string }) => {
  const dispatch = useBackgroundDispatch()

  const onCopyData = async ({
    data = "",
    notificationMessage = "",
  }: {
    data: string
    notificationMessage?: string
  }) => {
    await navigator.clipboard.writeText(data)
    await dispatch(setSnackbarConfig({ message: notificationMessage }))
  }

  return (
    <div className="options_menu_wrap">
      <SharedDropdown
        toggler={(toggle) => (
          <button
            type="button"
            className="icon_settings"
            role="menu"
            onClick={() => toggle()}
            tabIndex={0}
          />
        )}
        options={[
          {
            key: "copy",
            icon: "icons/s/copy.svg",
            label: "Copy payment code",
            onClick: async () => {
              await onCopyData({
                data: paymentCode,
                notificationMessage: "Payment code copied to clipboard",
              })
            },
          },
        ]}
      />

      <style jsx>
        {`
          .icon_settings {
            mask-image: url("./images/more_dots@2x.png");
            mask-repeat: no-repeat;
            mask-position: center;
            background-color: var(--white);
            mask-size: 15%;
            width: 4px;
            height: 20px;
            border: 10px solid transparent;
          }
          .icon_settings:hover {
            background-color: var(--green-40);
          }
        `}
      </style>
    </div>
  )
}

export default QiAccountOptionMenu
