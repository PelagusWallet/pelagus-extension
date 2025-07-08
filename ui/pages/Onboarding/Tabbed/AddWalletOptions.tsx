import React, { ReactElement, useMemo } from "react"
import { useTranslation } from "react-i18next"
import OnboardingRoutes from "./Routes"
import { intersperseWith } from "../../../utils/lists"
import SharedButton from "../../../components/Shared/SharedButton"
import SharedIcon from "../../../components/Shared/SharedIcon"

type AddWalletRowProps = {
  icon: string
  label: string
  url?: string
  onClick?: () => void
}

export function AddWalletRow({
  icon,
  url,
  label,
  onClick,
}: AddWalletRowProps): ReactElement {
  return (
    <SharedButton
      style={{ width: "100%" }}
      type="unstyled"
      size="medium"
      linkTo={url}
      onClick={onClick}
    >
      <div className="option">
        <SharedIcon icon={icon} width={32} color="white" />
        {label}
        <SharedIcon
          customStyles="margin-left: auto;"
          icon="chevron_right.svg"
          width={16}
          color="white"
        />
      </div>
      <style jsx>{`
        .option {
          display: flex;
          width: 100%;
          gap: 16px;
          align-items: center;
          background: #1C1C1C;
          border-radius: 4px;
          padding: 16px;
          font-family: "Segment";
          font-size: 16px;
          font-weight: 500;
          color: white;
          line-height: 24px;
          transition: opacity 0.2s ease;
        }

        .option:hover {
          opacity: 0.8;
        }
      `}</style>
    </SharedButton>
  )
}

export default function AddWalletOptions(): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.addWallet",
  })

  const optionsWithSpacer = useMemo(() => {
    const options = [
      {
        label: t("options.importSeed"),
        icon: "add_wallet/import.svg",
        url: OnboardingRoutes.IMPORT_SEED,
        isAvailable: true,
      },
      {
        label: t("options.importPrivateKey"),
        icon: "add_wallet/key-light.svg",
        url: OnboardingRoutes.IMPORT_PRIVATE_KEY,
        isAvailable: true,
      },
      {
        label: t("options.readOnly"),
        icon: "add_wallet/preview.svg",
        url: OnboardingRoutes.VIEW_ONLY_WALLET,
        isAvailable: true,
      },
    ].filter((item) => item.isAvailable)

    return intersperseWith(options, (i) => `spacer-${i}` as const)
  }, [t])

  return (
    <div className="options_container">
      <ul>
        {optionsWithSpacer.map((option) => {
          if (typeof option === "string") {
            return <li key={option} className="spacer" role="presentation" />
          }

          const { label, icon, url } = option
          return (
            <li key={url}>
              <AddWalletRow icon={icon} url={url} label={label} />
            </li>
          )
        })}
      </ul>
      <style jsx>
        {`
          .options_container {
            width: 100%;
            max-width: 480px;
            margin: 0 auto;
          }

          ul {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          li {
            display: flex;
          }

          .spacer {
            width: 100%;
            border: 0.5px solid #333333;
            margin: 4px 0;
          }

          @media (max-width: 520px) {
            .options_container {
              padding: 0 16px;
            }
          }
        `}
      </style>
    </div>
  )
}
