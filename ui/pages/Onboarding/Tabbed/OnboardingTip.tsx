import React from "react"

export default function OnboardingTip({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  return (
    <div>
      <div role="presentation" className="quote_icon">
        <span>i</span>
      </div>
      <q className="tip-text">{children}</q>
      <style jsx>
        {`
          .quote_icon {
            font-family: "TT Travels";
            font-weight: 500;
            font-size: 20px;
            line-height: 42px;
            text-align: center;
            color: var(--secondary-text);
            display: flex;
            align-items: center;
            gap: 18px;
            max-width: 350px;
            margin: 0 auto;
            justify-content: center;
          }

          .quote_icon::before,
          .quote_icon::after {
            content: "";
            max-width: 100px;
            display: inline-block;
            flex-grow: 1;
            border: 0.5px solid var(--secondary-bg);
          }

          q {
            font-family: "Segment";
            font-weight: 400;
            font-size: 16px;
            line-height: 16px;
            color: var(--secondary-text);
            text-align: center;
            display: block;
          }

          q::before,
          q::after {
            content: none;
          }

          :global(.reset_seed_link) {
            color: #1775E4;
            cursor: pointer;
            transition: opacity 0.2s ease;
            text-decoration: none;
          }

          :global(.reset_seed_link:hover) {
            opacity: 0.8;
          }
        `}
      </style>
    </div>
  )
}
