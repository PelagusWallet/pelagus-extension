import React, { ReactElement } from "react"
import FeeSettingsText from "./FeeSettingsText"

interface FeeSettingsButtonProps {
  onClick: () => void
}

export default function FeeSettingsButton({
  onClick,
}: FeeSettingsButtonProps): ReactElement {
  return (
    <button className="settings" type="button" onClick={onClick}>
      <FeeSettingsText />
      <img className="settings_image" src="./images/cog@2x.png" alt="" />
      <style jsx>
        {`
          .settings {
            height: 32px;
            display: flex;
            align-items: center;
            font-size: 16px;
            line-height: 20px;
            border-radius: 4px;
            padding: 0.3rem;
            border: 1px solid #33514e;
            transition: all 0.3s ease;
          }
          .settings_image {
            width: 14px;
            height: 14px;
            padding: 0 8px;
            transition: all 0.3s ease;
          }
          .settings:hover {
            border: 1px solid #578f89;
          }
          .settings:hover .settings_image {
            filter: brightness(1.5);
          }
          .tooltip_container {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
        `}
      </style>
    </button>
  )
}
