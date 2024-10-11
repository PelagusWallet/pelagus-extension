import React, { ReactElement } from "react"
import { useDispatch } from "react-redux"
import { useTranslation } from "react-i18next"
import {
  selectCurrentAccount,
  selectCurrentUtxoAccount,
  selectIsUtxoSelected,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { setSnackbarConfig } from "@pelagus/pelagus-background/redux-slices/ui"
import QRCode from "react-qr-code"
import { useBackgroundSelector } from "../hooks"
import SharedButton from "../components/Shared/SharedButton"

export default function Receive(): ReactElement {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const currentAccount: { address: string } =
    useBackgroundSelector(selectCurrentAccount)

  const { paymentCode = "" } =
    useBackgroundSelector(selectCurrentUtxoAccount) ?? {}

  const isUtxoSelected = useBackgroundSelector(selectIsUtxoSelected)

  if (!isUtxoSelected && !currentAccount) return <></>
  if (isUtxoSelected && !paymentCode) return <></>

  return (
    <section>
      <h1>
        <span className="icon_activity_send_medium" />
        {t("wallet.receiveAddress")}
      </h1>
      <div className="qr_code">
        <QRCode
          value={isUtxoSelected ? paymentCode : currentAccount.address}
          size={128}
        />
      </div>
      <div className="copy_wrap">
        <SharedButton
          iconMedium="copy"
          size="medium"
          type="primary"
          onClick={() => {
            navigator.clipboard.writeText(
              isUtxoSelected ? paymentCode : currentAccount.address
            )
            dispatch(setSnackbarConfig({ message: "Copied!" }))
          }}
        >
          {`${
            isUtxoSelected
              ? paymentCode.slice(0, 7)
              : currentAccount.address.slice(0, 7)
          }...${
            isUtxoSelected
              ? paymentCode.slice(-6)
              : currentAccount.address.slice(-6)
          }`}
        </SharedButton>
      </div>
      <style jsx>
        {`
          section {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
          }
          h1 {
            height: 32px;
            color: var(--trophy-gold);
            font-size: 22px;
            font-weight: 500;
            line-height: 32px;
            text-align: center;
            display: flex;
            align-items: center;
          }
          .qr_code {
            width: 176px;
            height: 176px;
            border-radius: 16px;
            background-color: #ffffff;
            margin-top: 31px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .copy_wrap {
            width: 215px;
            margin-top: 40px;
          }
          .icon_activity_send_medium {
            background: url("./images/pelagus_recieve.png");
            background-size: 24px 24px;
            width: 24px;
            height: 24px;
            margin-right: 8px;
          }
        `}
      </style>
    </section>
  )
}
