import React from "react"
import GoBackIcon from "../../../../public/images/_newDesign/GoBackIcon"

const SharedGoBackPageHeader = ({
  title,
  linkTo,
}: {
  title: string
  linkTo?:
    | {
        pathname: string
        search: string
        hash: string
        state: unknown
      }
    | string
}) => {
  return (
    <>
      <header className="header_wrapper">
        <GoBackIcon
          style={{
            position: "absolute",
            left: "0",
            top: "50%",
            transform: "translateY(-50%)",
            cursor: "pointer",
          }}
          linkTo={linkTo}
        />
        <h2>{title}</h2>
      </header>
      <style jsx>{`
        .header_wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 32px;
        }

        h2 {
          margin: 0;
          font-weight: 700;
          font-size: 18px;
          line-height: 28px;
          color: var(--primary-text);
        }
      `}</style>
    </>
  )
}

export default SharedGoBackPageHeader
