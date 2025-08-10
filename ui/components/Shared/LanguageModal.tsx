import React, { ReactElement } from "react"
import { getAvalableLanguages } from "../../_locales"
import { getLanguage, setLanguage } from "../../_locales/i18n"

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function LanguageModal({ isOpen, onClose }: Props): ReactElement {
  if (!isOpen) return <></>

  const handleLanguageSelect = (lang: string) => {
    setLanguage(lang)
    onClose()
  }

  const currentLang = getLanguage()
  const langOptions = getAvalableLanguages()

  return (
    <div className="modal_overlay" onClick={onClose}>
      <div className="modal_content" onClick={(e) => e.stopPropagation()}>
        <div className="modal_header">
          <h3>Select Language</h3>
          <button className="close_button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="language_list">
          {langOptions.map((option) => {
            const isSupported = option.value === 'en' || option.value === 'ru';
            const isDisabled = !isSupported;
            
            return (
              <button
                key={option.value}
                className={`language_option ${currentLang === option.value ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && handleLanguageSelect(option.value)}
                disabled={isDisabled}
              >
                {option.label}
                {isDisabled && <span className="coming_soon">(Coming Soon)</span>}
              </button>
            );
          })}
        </div>
      </div>
      <style jsx>
        {`
          .modal_overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
          }

          .modal_content {
            background: white;
            border-radius: 12px;
            padding: 24px;
            min-width: 280px;
            max-width: 320px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          }

          .modal_header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e5e7eb;
          }

          .modal_header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
          }

          .close_button {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #6b7280;
            padding: 4px;
            border-radius: 4px;
            transition: background-color 0.2s;
          }

          .close_button:hover {
            background-color: #f3f4f6;
          }

          .language_list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .language_option {
            background: none;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px 16px;
            text-align: left;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
            color: #374151;
          }

          .language_option:hover {
            background-color: #f9fafb;
            border-color: #d1d5db;
          }

          .language_option.selected {
            background-color: #3b82f6;
            border-color: #3b82f6;
            color: white;
          }

          .language_option.disabled {
            background-color: #f3f4f6;
            border-color: #d1d5db;
            color: #9ca3af;
            cursor: not-allowed;
            opacity: 0.6;
          }

          .language_option.disabled:hover {
            background-color: #f3f4f6;
            border-color: #d1d5db;
          }

          .coming_soon {
            font-size: 12px;
            color: #6b7280;
            margin-left: 8px;
            font-style: italic;
          }
        `}
      </style>
    </div>
  )
} 