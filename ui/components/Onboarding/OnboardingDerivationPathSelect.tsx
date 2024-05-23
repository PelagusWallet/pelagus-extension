import React, {
  KeyboardEventHandler,
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import { I18nKey } from "../../_locales/i18n"
import SharedButton from "../Shared/SharedButton"
import SharedInput from "../Shared/SharedInput"
import SharedModal from "../Shared/SharedModal"
import SharedSelect, { Option } from "../Shared/SharedSelect"

type DerivationPath = {
  value: string
  label: I18nKey
  hideActiveValue?: boolean
}

export enum DefaultPathIndex {}

const defaultDerivationPaths: Record<DefaultPathIndex, DerivationPath> = {}

const initialCustomPath = {
  coinType: "0",
  account: "0",
  change: "0",
  isReset: true,
}

export default function OnboardingDerivationPathSelect({
  onChange,
  defaultPath,
}: {
  onChange: (path: string) => void
  defaultPath?: DefaultPathIndex
}): ReactElement {
  const { t, i18n } = useTranslation("translation", { keyPrefix: "onboarding" })

  const defaultPaths: Option[] = useMemo(
    () =>
      Object.values(defaultDerivationPaths).map((path) => ({
        ...path,
        label: i18n.t(path.label),
      })),
    [i18n]
  )

  const [derivationPaths, setDerivationPaths] = useState<Option[]>([])

  const [modalStep, setModalStep] = useState(0)
  const [customPath, setCustomPath] = useState(initialCustomPath)
  const [customPathLabel, setCustomPathLabel] = useState("")
  const [defaultIndex, setDefaultIndex] = useState<number | undefined>(
    defaultPath
  )

  // Reset value to display placeholder after adding a custom path
  const customPathValue = customPath.isReset
    ? ""
    : `m/44'/${customPath.coinType}'/${customPath.account}'/${customPath.change}`

  const coinTypeRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (modalStep === 2 && coinTypeRef.current) {
      coinTypeRef.current.focus()
      coinTypeRef.current.select()
    }
  }, [modalStep])

  const handleAddCustomPath = () => {
    if (
      customPathLabel.trim().length < 1 &&
      customPathValue.trim().length < 1
    ) {
      return
    }

    setModalStep(0)
    onChange(customPathValue)
    // Change active index of the Select with custom option
    setDefaultIndex(derivationPaths.length)

    // TODO It might be considered to save the custom path to the local db
    setDerivationPaths([
      ...derivationPaths,
      { label: customPathLabel, value: customPathValue },
    ])

    // Reset custom path fields
    setCustomPath(initialCustomPath)
    setCustomPathLabel("")
  }

  const handleChangeCustomPath = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomPath({
      ...customPath,
      [e.target.name]: e.target.value,
      isReset: false,
    })
  }

  const handleKeypressCustomInput: KeyboardEventHandler<HTMLInputElement> = (
    e
  ) => {
    if (e.key === "Enter") setModalStep(1)
  }

  const derivationPathOptions = [...defaultPaths, ...derivationPaths]

  return (
    <>
      <SharedModal
        header={t("addDerivationPath")}
        isOpen={modalStep > 0}
        onClose={() => setModalStep((prev) => prev - 1)}
        minHeight={modalStep === 2 ? "463px" : "auto"}
      >
        {modalStep === 1 && (
          <>
            <div className="input_wrap">
              <SharedInput
                id="custom_path_label"
                label={t("pathLabel")}
                onChange={(value) => setCustomPathLabel(value)}
                focusedLabelBackgroundColor="var(--green-120)"
                value={customPathLabel}
              />
            </div>
            <div className="input_wrap">
              <SharedInput
                id="custom_path_value"
                label={`${t("customPath")} (m/44'/0'/0)`}
                onFocus={() => setModalStep(2)}
                focusedLabelBackgroundColor="var(--green-120)"
                value={customPathValue}
              />
            </div>

            <SharedButton
              type="primary"
              size="medium"
              onClick={handleAddCustomPath}
            >
              {t("addDerivationPath")}
            </SharedButton>
          </>
        )}
        {modalStep === 2 && (
          <div className="input_wrap custom">
            <span>m/44&#39;/</span>
            <input
              ref={coinTypeRef}
              name="coinType"
              className="custom_input"
              value={customPath.coinType}
              onChange={handleChangeCustomPath}
              onKeyPress={handleKeypressCustomInput}
            />
            <span>&#39;/</span>
            <input
              name="account"
              className="custom_input"
              value={customPath.account}
              onChange={handleChangeCustomPath}
              onKeyPress={handleKeypressCustomInput}
            />
            <span>&#39;/</span>
            <input
              name="change"
              className="custom_input"
              value={customPath.change}
              onChange={handleChangeCustomPath}
              onKeyPress={handleKeypressCustomInput}
            />
          </div>
        )}
      </SharedModal>
      <SharedSelect
        label={t("derivationPath")}
        options={derivationPathOptions}
        onChange={onChange}
        defaultIndex={defaultIndex}
        triggerLabel={t("addCustomPath")}
        onTrigger={() => setModalStep(1)}
        showValue
        showOptionValue
        placement="top"
        width="100%"
      />
      <style jsx>{`
        .input_wrap {
          margin-bottom: 32px;
        }
        .input_wrap.custom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 16px;
          line-height: 24px;
          font-weight: 600;
          margin-top: 6px;
        }
        .custom_input {
          box-sizing: border-box;
          padding: 12px 16px;
          color: var(--green-5);
          border: 2px solid var(--green-60);
          border-radius: 4px;
          width: 60px;
          height: 48px;
        }
        .custom_input:last-child {
          width: 48px;
        }
      `}</style>
    </>
  )
}
