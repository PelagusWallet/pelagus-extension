import React, {
  KeyboardEvent,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import classNames from "classnames"

import { useOnClickOutside } from "../../hooks"

export type Option = { value: string; label: string; hideActiveValue?: boolean }

type Props = {
  options: Option[] | string[]
  onChange: (value: string) => void
  defaultIndex?: number
  label?: string
  ariaLabel?: string
  placement?: "top" | "bottom"
  triggerLabel?: string
  onTrigger?: () => void
  showValue?: boolean
  showOptionValue?: boolean
  width?: string | number
  labelColor?: string
  variant?: "default" | "small"
}

let nextSelectId = 0

function boundedIndex(index: number, optionCount: number): number {
  if (optionCount === 0) return -1
  return Math.min(Math.max(index, 0), optionCount - 1)
}

export default function SharedSelect(props: Props): ReactElement {
  const {
    options: initialOptions,
    onChange,
    defaultIndex = 0,
    label,
    ariaLabel,
    placement = "bottom",
    triggerLabel,
    onTrigger,
    showValue,
    showOptionValue,
    width = "320px",
    variant = "default",
    labelColor = "var(--secondary-text)",
  } = props

  const options = useMemo(
    () =>
      initialOptions.map((option) =>
        typeof option !== "string"
          ? option
          : {
              value: option,
              label: option,
            }
      ) as Option[],
    [initialOptions]
  )
  const cssWidth = typeof width === "number" ? `${width}px` : width
  const initialIndex = boundedIndex(defaultIndex, options.length)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [focusedIndex, setFocusedIndex] = useState(initialIndex)
  const [selectId] = useState(() => {
    nextSelectId += 1
    return `shared-select-${nextSelectId}`
  })
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const optionRefs = useRef<Array<HTMLLIElement | null>>([])
  const selectContainerRef = useRef<HTMLDivElement | null>(null)

  const currentOption = options[activeIndex]
  const currentLabel = currentOption?.label ?? "Select an option"
  const currentValue = currentOption?.value
  const currentHideActiveValue = currentOption?.hideActiveValue ?? false

  const closeDropdown = useCallback((restoreFocus = false) => {
    setIsDropdownOpen(false)
    if (restoreFocus) buttonRef.current?.focus()
  }, [])

  const handleOutsideClick = useCallback(() => closeDropdown(), [closeDropdown])
  useOnClickOutside(selectContainerRef, handleOutsideClick)

  useEffect(() => {
    const nextIndex = boundedIndex(defaultIndex, options.length)
    setActiveIndex(nextIndex)
    setFocusedIndex(nextIndex)
  }, [defaultIndex, options.length])

  useEffect(() => {
    if (isDropdownOpen && focusedIndex >= 0) {
      optionRefs.current[focusedIndex]?.focus()
    }
  }, [focusedIndex, isDropdownOpen])

  const openDropdown = () => {
    setFocusedIndex(activeIndex >= 0 ? activeIndex : 0)
    setIsDropdownOpen(true)
  }

  const selectOption = (index: number) => {
    const selectedOption = options[index]
    if (!selectedOption) return

    setActiveIndex(index)
    setFocusedIndex(index)
    setIsDropdownOpen(false)
    onChange(selectedOption.value)
    buttonRef.current?.focus()
  }

  const moveFocus = (offset: number) => {
    if (options.length === 0) return
    setFocusedIndex((currentIndex) => {
      const startingIndex = currentIndex < 0 ? 0 : currentIndex
      return (startingIndex + offset + options.length) % options.length
    })
  }

  const handleButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        if (isDropdownOpen) moveFocus(1)
        else openDropdown()
        break
      case "ArrowUp":
        event.preventDefault()
        if (isDropdownOpen) moveFocus(-1)
        else openDropdown()
        break
      case "Enter":
      case " ":
        event.preventDefault()
        if (isDropdownOpen) closeDropdown()
        else openDropdown()
        break
      case "Escape":
        if (isDropdownOpen) {
          event.preventDefault()
          closeDropdown(true)
        }
        break
      default:
        break
    }
  }

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLLIElement>,
    index: number
  ) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        moveFocus(1)
        break
      case "ArrowUp":
        event.preventDefault()
        moveFocus(-1)
        break
      case "Home":
        event.preventDefault()
        setFocusedIndex(0)
        break
      case "End":
        event.preventDefault()
        setFocusedIndex(options.length - 1)
        break
      case "Enter":
      case " ":
        event.preventDefault()
        selectOption(index)
        break
      case "Escape":
        event.preventDefault()
        closeDropdown(true)
        break
      case "Tab":
        closeDropdown()
        break
      default:
        break
    }
  }

  return (
    <>
      <div
        className={classNames("select", placement, variant, {
          active: isDropdownOpen,
        })}
        ref={selectContainerRef}
      >
        {label && (
          <label htmlFor={`${selectId}-button`} id={`${selectId}-label`}>
            {label}
          </label>
        )}
        <button
          ref={buttonRef}
          id={`${selectId}-button`}
          type="button"
          className="button"
          aria-haspopup="listbox"
          aria-expanded={isDropdownOpen}
          aria-controls={`${selectId}-options`}
          aria-labelledby={label ? `${selectId}-label` : undefined}
          aria-label={
            !label && ariaLabel ? `${ariaLabel}: ${currentLabel}` : undefined
          }
          onClick={() => {
            if (isDropdownOpen) closeDropdown()
            else openDropdown()
          }}
          onKeyDown={handleButtonKeyDown}
        >
          <span className="current_value">
            {showValue && currentValue && !currentHideActiveValue
              ? `${currentLabel} — ${currentValue}`
              : currentLabel}
          </span>
          <span className="icon" aria-hidden="true" />
        </button>
        {isDropdownOpen && (
          <ul
            id={`${selectId}-options`}
            className="options"
            role="listbox"
            aria-labelledby={label ? `${selectId}-label` : undefined}
            aria-label={!label ? ariaLabel : undefined}
          >
            {options.map((option, index) => (
              <li
                ref={(element) => {
                  optionRefs.current[index] = element
                }}
                id={`${selectId}-option-${index}`}
                key={option.value}
                role="option"
                tabIndex={focusedIndex === index ? 0 : -1}
                className={classNames("option", {
                  selected: activeIndex === index,
                })}
                aria-selected={activeIndex === index}
                onClick={() => selectOption(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                <div className="option_content">
                  <span>{option.label}</span>
                  <span className="option_meta">
                    {showOptionValue && (
                      <span className="option_value">{option.value}</span>
                    )}
                    {activeIndex === index && (
                      <span className="check" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </span>
                </div>
              </li>
            ))}
            {triggerLabel && (
              <li className="custom_option">
                <button
                  type="button"
                  onClick={() => {
                    closeDropdown()
                    onTrigger?.()
                  }}
                >
                  {triggerLabel}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
      <style jsx>
        {`
          .select {
            box-sizing: border-box;
            display: inline-block;
            position: relative;
            width: ${cssWidth};
            background-color: transparent;
          }

          label {
            color: ${labelColor};
            display: block;
            margin: 0 0 8px;
            font-size: 12px;
            font-weight: 500;
            line-height: 16px;
          }

          .button {
            position: relative;
            box-sizing: border-box;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            width: 100%;
            min-height: 44px;
            padding: 0 14px;
            overflow: hidden;
            color: var(--primary-text);
            background: var(--secondary-bg);
            border: 1px solid var(--border-light);
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            line-height: 20px;
            transition: border-color 120ms ease, background-color 120ms ease,
              box-shadow 120ms ease;
          }

          .button:hover {
            border-color: var(--secondary-text);
          }

          .button:focus-visible {
            outline: 2px solid var(--trophy-gold);
            outline-offset: 2px;
          }

          .select.active .button {
            border-color: var(--trophy-gold);
            box-shadow: 0 0 0 1px var(--trophy-gold);
          }

          .current_value {
            min-width: 0;
            overflow: hidden;
            text-align: left;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .icon {
            width: 12px;
            height: 8px;
            flex: 0 0 auto;
            background-color: var(--secondary-text);
            mask-image: url("./images/chevron_down.svg");
            mask-position: center;
            mask-repeat: no-repeat;
            mask-size: 12px 8px;
            transition: transform 140ms ease, background-color 120ms ease;
          }

          .select.active .icon {
            background-color: var(--trophy-gold);
            transform: rotate(180deg);
          }

          .options {
            position: absolute;
            left: 0;
            z-index: 1000;
            box-sizing: border-box;
            width: 100%;
            max-height: 280px;
            margin: 0;
            padding: 4px;
            overflow-x: hidden;
            overflow-y: auto;
            color: var(--primary-text);
            background: var(--primary-bg);
            border: 1px solid var(--border-light);
            border-radius: 10px;
            box-shadow: var(--shadow-light);
            list-style: none;
          }

          .select.bottom .options {
            top: calc(100% + 6px);
            transform-origin: top center;
            animation: reveal_down 120ms ease-out;
          }

          .select.top .options {
            bottom: calc(100% + 6px);
            transform-origin: bottom center;
            animation: reveal_up 120ms ease-out;
          }

          .option {
            box-sizing: border-box;
            display: flex;
            min-height: 40px;
            padding: 0 10px;
            align-items: center;
            border-radius: 7px;
            color: var(--primary-text);
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            line-height: 20px;
          }

          .option:hover,
          .option:focus-visible {
            outline: none;
            background: var(--secondary-bg);
          }

          .option.selected {
            background: var(--secondary-bg);
          }

          .option_content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            width: 100%;
          }

          .option_meta {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: var(--secondary-text);
          }

          .check {
            color: var(--trophy-gold);
            font-size: 13px;
            font-weight: 700;
          }

          .custom_option {
            padding: 4px 0 0;
            border-top: 1px solid var(--secondary-bg);
            list-style: none;
          }

          .custom_option button {
            box-sizing: border-box;
            width: 100%;
            min-height: 40px;
            padding: 0 10px;
            color: var(--trophy-gold);
            border-radius: 7px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            text-align: left;
          }

          .custom_option button:hover,
          .custom_option button:focus-visible {
            outline: none;
            background: var(--secondary-bg);
          }

          .select.small .button {
            min-height: 40px;
            padding: 0 10px;
            font-size: 13px;
          }

          .select.small .option {
            min-height: 36px;
            padding: 0 8px;
            font-size: 13px;
          }

          @keyframes reveal_down {
            from {
              opacity: 0;
              transform: translateY(-4px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes reveal_up {
            from {
              opacity: 0;
              transform: translateY(4px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .button,
            .icon,
            .options {
              animation: none;
              transition: none;
            }
          }
        `}
      </style>
    </>
  )
}

SharedSelect.defaultProps = {
  defaultIndex: 0,
  label: undefined,
  ariaLabel: undefined,
  placement: "bottom",
  triggerLabel: undefined,
  onTrigger: undefined,
  showValue: false,
  showOptionValue: false,
  width: "320px",
  labelColor: "var(--secondary-text)",
  variant: "default",
}
