import React, { ReactElement, useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  getSwitchNetworkRequestDetails,
  switchNetworkUserResponse,
} from "@pelagus/pelagus-background/redux-slices/ui"
import { SwitchNetworkRequestData } from "@pelagus/pelagus-background/services/provider-bridge/utils"
import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
import { PELAGUS_NETWORKS } from "@pelagus/pelagus-background/constants/networks/networks"
import SharedButton from "../components/Shared/SharedButton"
import SharedNetworkIcon from "../components/Shared/SharedNetworkIcon"
import SharedSkeletonLoader from "../components/Shared/SharedSkeletonLoader"
import { useBackgroundDispatch } from "../hooks"

/**
 * Approval for a dApp's wallet_switchEthereumChain. The whole wallet moves
 * with it, so it is the user's decision rather than the site's.
 */
export default function SwitchNetworkRequest(): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "switchNetwork" })
  const dispatch = useBackgroundDispatch()

  const requestId = new URLSearchParams(window.location.search).get("requestId")
  const [request, setRequest] = useState<SwitchNetworkRequestData | null>(null)

  // The same network the selector shows, so its icon comes from one place.
  const network = PELAGUS_NETWORKS.find(
    ({ chainID }) => chainID === request?.chainID
  )

  useEffect(() => {
    if (!requestId) return

    // Closing the window is a rejection, so the dApp is never left waiting.
    window.onbeforeunload = () => {
      dispatch(switchNetworkUserResponse([requestId, false]))
    }

    const load = async () => {
      const details = (await dispatch(
        getSwitchNetworkRequestDetails(requestId)
      )) as AsyncThunkFulfillmentType<typeof getSwitchNetworkRequestDetails>

      if (!details) {
        // Already answered or expired; nothing to decide here.
        window.onbeforeunload = null
        window.close()
        return
      }

      setRequest(details)
    }

    load()
  }, [dispatch, requestId])

  const respond = useCallback(
    (approved: boolean) => {
      if (requestId) {
        dispatch(switchNetworkUserResponse([requestId, approved]))
      }
      window.onbeforeunload = null
      setTimeout(() => window.close(), 300)
    },
    [dispatch, requestId]
  )

  return (
    <>
      <section className="standard_width">
        <h1 className="serif_header">{t("title")}</h1>
        <SharedSkeletonLoader isLoaded={request !== null} height={72}>
          <p className="origin" title={request?.origin}>
            {request?.origin}
          </p>
          {network && (
            <div className="network_icon">
              <SharedNetworkIcon network={network} size={56} hasBackground />
            </div>
          )}
          <p className="network">{request?.chainName}</p>
          <p className="chain_id">
            {t("chainLabel", { chainID: request?.chainID ?? "" })}
          </p>
        </SharedSkeletonLoader>
        <p className="caption">{t("walletWideCaption")}</p>
      </section>
      <div className="footer_actions">
        <SharedButton
          size="large"
          type="secondary"
          onClick={() => respond(false)}
        >
          {t("reject")}
        </SharedButton>
        <SharedButton
          size="large"
          type="primary"
          isDisabled={request === null}
          onClick={() => respond(true)}
        >
          {t("approve")}
        </SharedButton>
      </div>
      <style jsx>{`
        section {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        h1 {
          margin: 16px 0;
          text-align: center;
        }
        .network_icon {
          display: flex;
          justify-content: center;
          margin-top: 16px;
        }
        .origin {
          font-size: 16px;
          line-height: 24px;
          color: var(--green-20);
          margin: 0;
          overflow-wrap: anywhere;
          text-align: center;
        }
        .chain_id {
          font-size: 14px;
          line-height: 20px;
          color: var(--green-40);
          margin: 4px 0 0;
        }
        .network {
          font-size: 22px;
          line-height: 32px;
          color: var(--trophy-gold);
          margin: 8px 0 0;
        }
        .caption {
          color: var(--green-40);
          font-size: 14px;
          line-height: 20px;
          text-align: center;
          margin: 8px 0 0;
        }
        .footer_actions {
          position: fixed;
          bottom: 0;
          display: flex;
          width: 100%;
          padding: 0 16px 16px;
          box-sizing: border-box;
          justify-content: space-between;
          background-color: var(--hunter-green);
        }
      `}</style>
    </>
  )
}
