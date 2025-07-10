import React, { ReactElement } from "react"

type Props = {
  setPanelNumber: (x: number) => void
  panelNumber: number
  panelNames: string[]
  panelId?: string
}

export default function SharedPanelSwitcher(props: Props): ReactElement {
  const {
    setPanelNumber,
    panelNumber,
    panelNames,
    panelId = "panel_switcher",
  } = props

  // Check if only one meaningful panel exists (e.g., when first panel is empty)
  const meaningfulPanels = panelNames.filter(name => name.trim() !== "")
  const isSinglePanel = meaningfulPanels.length === 1

  // TODO: make these styles work for more than two panels
  // .selected::after is the hardcoded culprit.
  return (
    <nav>
      <ul role="tablist" data-testid={panelId} className={isSinglePanel ? "single-panel" : ""}>
        {panelNames.slice(0, 3).map((name, index) => {
          // Don't render empty panels
          if (name.trim() === "") return null
          
          return (
            <li key={name}>
              <button
                type="button"
                role="tab"
                aria-selected={panelNumber === index}
                onClick={() => {
                  setPanelNumber(index)
                }}
                className={`option${panelNumber === index ? " selected" : ""}`}
              >
                {name}
              </button>
            </li>
          )
        })}
      </ul>
      <style jsx>
        {`
          nav {
            width: 100%;
            position: relative;
            display: block;
            height: 31px;
            border-bottom: 1px solid
              var(--panel-switcher-border, var(--secondary-bg));
          }
          button {
            color: var(--secondary-text);
            font-size: 16px;
          }
          ul {
            display: flex;
            justify-content: center;
            padding-left: 0;
            padding-bottom: 12px;
            gap: 80px;
          }
          .single-panel {
            gap: 0;
          }
          .option {
            cursor: pointer;
            min-width: 80px;
            text-align: center;
          }
          .option:hover {
            color: var(--primary-text);
          }
          .selected {
            font-weight: 500;
            color: var(--primary-text);
            text-align: center;
            display: flex;
            justify-content: center;
          }
          .selected:hover {
            color: var(--primary-text);
          }
          .selected::after {
            content: "";
            width: 100px;
            height: 3px;
            background-color: var(--trophy-gold);
            border-radius: 10px;
            position: absolute;
            display: block;
            margin-top: 29px;
          }
        `}
      </style>
    </nav>
  )
}
