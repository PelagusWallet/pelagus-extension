import React, { ReactElement, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useBackgroundDispatch, useBackgroundSelector } from "../hooks"
import { selectCurrentAccountTotal } from "@pelagus/pelagus-background/redux-slices/selectors"
import { selectPendingProposal } from "@pelagus/pelagus-background/redux-slices/wallet-connect"
import { clearPendingProposal, approveWalletConnectSession, rejectWalletConnectSession, pairWalletConnectUri } from "@pelagus/pelagus-background/redux-slices/wallet-connect"
import SharedButton from "../components/Shared/SharedButton"
import SharedAccountItemSummary from "../components/Shared/SharedAccountItemSummary"
import RequestingDAppBlock from "./DAppConnect/RequestingDApp"

export default function WalletConnectPage(): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "walletConnect" })
  const dispatch = useBackgroundDispatch()
  const currentAccount = useBackgroundSelector(selectCurrentAccountTotal)
  const pendingProposal = useBackgroundSelector(selectPendingProposal)

  useEffect(() => {
    // Handle WalletConnect URI pairing
    const uri = new URLSearchParams(window.location.search).get('uri')
    if (uri) {
      dispatch(pairWalletConnectUri({ uri }))
    }

    // Clean up when window closes
    const handleBeforeUnload = () => {
      if (pendingProposal?.id) {
        try {
          dispatch(rejectWalletConnectSession({
            proposalId: pendingProposal.id
          }))
        } catch (error) {
          // If proposal doesn't exist anymore, just clear the state
          console.log("Proposal already handled or expired")
        } finally {
          dispatch(clearPendingProposal())
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [dispatch, pendingProposal])

  const handleApprove = useCallback(async () => {
    if (pendingProposal?.id && currentAccount?.address) {
      try {
        await dispatch(approveWalletConnectSession({
          proposalId: pendingProposal.id,
          address: currentAccount.address
        }))
      } catch (error) {
        console.error("Error approving session:", error)
      } finally {
        window.close()
      }
    }
  }, [dispatch, pendingProposal, currentAccount])

  const handleReject = useCallback(async () => {
    if (pendingProposal?.id) {
      try {
        await dispatch(rejectWalletConnectSession({
          proposalId: pendingProposal.id
        }))
      } catch (error) {
        console.error("Error rejecting session:", error)
      } finally {
        dispatch(clearPendingProposal())
        window.close()
      }
    }
  }, [dispatch, pendingProposal])

  if (!pendingProposal) {
    return <div>No pending proposal</div>
  }

  return (
    <div className="page">
      <div className="standard_width">
        <div className="top">
          <div className="wordmark" />
        </div>
        <div className="content">
          <div className="title">{t("connectRequest")}</div>
          <RequestingDAppBlock
            title={pendingProposal.dappName}
            url={pendingProposal.dappUrl}
            faviconUrl={pendingProposal.dappIcon}
          />
          <div className="account">
            <div className="account_title">{t("selectedAccount")}</div>
            {currentAccount && (
              <SharedAccountItemSummary
                accountTotal={currentAccount}
                isSelected
              />
            )}
          </div>
          <div className="actions">
            <SharedButton
              type="primary"
              size="large"
              onClick={handleApprove}
            >
              {t("approve")}
            </SharedButton>
            <SharedButton
              type="secondary"
              size="large"
              onClick={handleReject}
            >
              {t("reject")}
            </SharedButton>
          </div>
        </div>
      </div>
      <style jsx>{`
        .page {
          background-color: var(--hunter-green);
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .standard_width {
          width: 100%;
          max-width: 384px;
          padding: 0 16px;
        }
        .top {
          display: flex;
          justify-content: center;
          padding: 24px 0;
        }
        .wordmark {
          background: url("./images/wordmark.svg");
          background-size: cover;
          width: 120px;
          height: 32px;
        }
        .content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .title {
          color: var(--white);
          font-size: 24px;
          font-weight: 500;
          text-align: center;
        }
        .account {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .account_title {
          color: var(--white);
          font-size: 16px;
          font-weight: 500;
        }
        .actions {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
      `}</style>
    </div>
  )
} 