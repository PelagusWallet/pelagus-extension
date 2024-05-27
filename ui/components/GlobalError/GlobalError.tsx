import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import SharedButton from "../Shared/SharedButton"

export default function GlobalError(): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "globalError" })

  return (
    <section className="standard_width">
      <img className="bowl_image" src="./images/anchor_wheel.png" alt="" />
      <h1 className="title">{t("title")}</h1>
      <p className="simple_text description">{t("desc")}</p>
      <SharedButton
        type="primary"
        size="large"
        onClick={() => window.location.reload()}
      >
        {t("submitBtn")}
      </SharedButton>
      <style jsx>
        {`
          section {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
            gap: 25px;
          }
          .bowl_image {
            width: 90px;
          }
          .title {
            color: var(--trophy-gold);
            margin: 0;
          }
          .description {
            width: 65%;
            text-align: center;
            margin: 0 0 15px 0;
          }
        `}
      </style>
    </section>
  )
}
