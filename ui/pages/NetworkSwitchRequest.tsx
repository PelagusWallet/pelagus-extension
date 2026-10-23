import React, { ReactElement, useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  addNetworkUserResponse,
  getAddNetworkRequestDetails,
} from "@pelagus/pelagus-background/redux-slices/ui"
import type { NetworkSwitchRequestData } from "@pelagus/pelagus-background/services/provider-bridge"
import { NetworkInterface } from "@pelagus/pelagus-background/constants/networks/networkTypes"
import { useBackgroundDispatch } from "../hooks"
import SharedButton from "../components/Shared/SharedButton"
import SharedNetworkIcon from "../components/Shared/SharedNetworkIcon"
import RequestingDAppBlock from "./DAppConnect/RequestingDApp"
import ErrorFallback from "./ErrorFallback"

function NetworkRow(props: {
  label: string
  network: NetworkInterface
}): ReactElement {
  const { label, network } = props
  return (
    <div className="network_row">
      <span className="label">{label}</span>
      <SharedNetworkIcon network={network} size={24} />
      <span className="name">{network.baseAsset.name}</span>
      <style jsx>{`
        .network_row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background-color: var(--primary-bg);
          border-radius: 8px;
          margin-bottom: 8px;
        }
        .label {
          width: 40px;
          color: var(--secondary-text);
          font-size: 14px;
        }
        .name {
          color: var(--primary-text);
          font-size: 16px;
          font-weight: 500;
        }
      `}</style>
    </div>
  )
}

export default function NetworkSwitchRequest(): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "dappConnection" })
  const dispatch = useBackgroundDispatch()
  const requestId =
    new URLSearchParams(window.location.search).get("requestId") ?? ""

  const [request, setRequest] = useState<
    NetworkSwitchRequestData | undefined | null
  >(null)

  useEffect(() => {
    const load = async () => {
      const result = (await dispatch(
        getAddNetworkRequestDetails(requestId)
      )) as unknown as { payload?: NetworkSwitchRequestData }
      setRequest(result?.payload)
    }
    load().catch(() => setRequest(undefined))
  }, [dispatch, requestId])

  const respond = useCallback(
    async (approved: boolean) => {
      await dispatch(addNetworkUserResponse([requestId, approved]))
      window.close()
    },
    [dispatch, requestId]
  )

  // Still loading.
  if (request === null) return <></>

  // The request was answered, timed out or never existed.
  if (request === undefined) return <ErrorFallback />

  return (
    <div className="page">
      <section className="standard_width">
        <h1 className="serif_header">{t("switchNetworkTitle")}</h1>
        <div className="dapp">
          <RequestingDAppBlock
            title={request.siteTitle}
            url={request.origin}
            faviconUrl={request.favicon}
          />
        </div>
        <NetworkRow
          label={t("switchNetworkFrom")}
          network={request.fromNetwork}
        />
        <NetworkRow label={t("switchNetworkTo")} network={request.toNetwork} />
        <p className="warning">{t("switchNetworkWarning")}</p>
      </section>
      <div className="footer_actions">
        <SharedButton
          size="large"
          type="secondary"
          onClick={() => respond(false)}
        >
          {t("rejectSwitchNetwork")}
        </SharedButton>
        <SharedButton type="primary" size="large" onClick={() => respond(true)}>
          {t("acceptSwitchNetwork")}
        </SharedButton>
      </div>
      <style jsx>{`
        .page {
          background-color: var(--secondary-bg);
          height: 100vh;
          width: 100vw;
          z-index: 1000;
        }
        section {
          display: flex;
          flex-direction: column;
          margin: 0 auto;
        }
        h1 {
          color: var(--trophy-gold);
          margin-top: 45px;
          margin-bottom: 25px;
          text-align: center;
        }
        .dapp {
          display: flex;
          align-items: center;
          padding: 16px;
          background-color: var(--primary-bg);
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .warning {
          color: var(--primary-text);
          font-size: 14px;
          line-height: 20px;
          margin-top: 8px;
        }
        .footer_actions {
          position: fixed;
          bottom: 0;
          display: flex;
          width: 100%;
          padding: 0 16px;
          box-sizing: border-box;
          align-items: center;
          height: 80px;
          justify-content: space-between;
          box-shadow: 0 0 5px rgba(0, 20, 19, 0.5);
          background-color: var(--secondary-bg);
        }
      `}</style>
      <style jsx global>{`
        body {
          background-color: var(--secondary-bg);
        }
      `}</style>
    </div>
  )
}
