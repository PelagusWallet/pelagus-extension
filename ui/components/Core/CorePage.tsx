import React, { ReactElement } from "react"
import Snackbar from "../Snackbar/Snackbar"
import TopMenu from "../TopMenu/TopMenu"

interface Props {
  children: React.ReactNode
  hasTopBar?: boolean
}

export default function CorePage(props: Props): ReactElement {
  const { children, hasTopBar } = props

  return (
    <section>
      {hasTopBar ? <TopMenu /> : <></>}
      <main>
        {children}
        <Snackbar />
      </main>
      <style jsx>
        {`
          section {
            height: 100%;
            display: flex;
            flex-direction: column;
            background-color: var(--primary-bg);
          }
          main {
            width: 100%;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            flex-grow: 1;
            margin: 0 auto;
            align-items: center;
            background-color: var(--primary-bg);
            height: 100%;
          }
        `}
      </style>
    </section>
  )
}

CorePage.defaultProps = {
  hasTopBar: true,
}
