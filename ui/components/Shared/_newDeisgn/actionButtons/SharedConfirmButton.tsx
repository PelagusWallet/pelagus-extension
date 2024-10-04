import React from "react"

const SharedConfirmButton = ({
  title = "",
  onClick = () => {},
}: {
  title?: string
  onClick?: () => void
}) => {
  return (
    <>
      <button type="button" className="button" onClick={onClick}>
        {title}
      </button>

      <style jsx>{`
        .button:hover {
          opacity: 90%;
        }

        .button {
          width: 100%;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          padding: 10px 0;
          border-radius: 4px;
          border: 1px solid var(--accent-color);
          background: var(--accent-color);
          color: var(--contrast-text);
          text-align: center;
        }
      `}</style>
    </>
  )
}

export default SharedConfirmButton
