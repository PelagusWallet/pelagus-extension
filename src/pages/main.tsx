// @material-tailwind/react
import React from "react"
import { Route, Router } from "wouter"

import { Storage } from "@plasmohq/storage"

import MenuBar from "~components/navigation/MenuBar"
import AddAddress from "~pages/accounts/addAddress"
import Collectibles from "~pages/main/collectibles"
import Contacts from "~pages/main/contacts"
import Home from "~pages/main/home"
import Swap from "~pages/main/swap"
import Unlock from "~pages/unlock/unlock"
import { useSetUp } from "~storage/wallet"
import { useHashLocation } from "~utils/router"

import "../style.css"

import { useEffect, useState } from "react"
import { useLocation } from "wouter"

import { useStorage } from "@plasmohq/storage/hook"

import type { Network } from "~background/services/network/chains"
import Fetcher from "~pages/main/fetcher"
import Receive from "~pages/main/receive"
import SendConfirm from "~pages/main/send/confirm"
import SendFrom from "~pages/main/send/from"
import SendTo from "~pages/main/send/to"
import SettingsAbout from "~pages/settings/about"
import AdvancedList from "~pages/settings/advanced/advancedList"
import DomainPermissions from "~pages/settings/advanced/permissions/permissions"
import GeneralSettings from "~pages/settings/general/general"
import SettingsList from "~pages/settings/list"
import AddCustomNetwork from "~pages/settings/networks/add"
import SwitchNetworks from "~pages/settings/networks/switch"
import SecurityAndPrivacy from "~pages/settings/securityAndPrivacy"
import AddOrUpdateCustomToken from "~pages/token/addOrUpdateToken"
import TokenPage from "~pages/token/token"

const storage = new Storage({ area: "local" })

function MainPage() {
  const [activeNetwork] = useStorage<Network>({
    key: "active_network",
    instance: storage
  })

  const [signedIn] = useStorage<boolean>({
    key: "signed_in",
    instance: storage
  })

  const [darkMode] = useStorage<boolean>({
    key: "dark_mode",
    instance: storage
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [darkMode])

  // Check user wallet accounts, load if first visit.
  useSetUp(darkMode)

  return (
    <div className="bg-container">
      {signedIn && (
        <div>
          <Fetcher />
          <Router hook={useHashLocation}>
            <MenuBar />
            <div className="pt-[66px]"></div>
            <Route path="/" component={() => <Home />} />
            <Route path="/add-address" component={AddAddress} />
            <Route path="/send" component={SendTo} />
            <Route
              path="/send?/confirm/:fromAddr?/:toAddr"
              component={SendConfirm}
            />
            <Route path="/receive" component={Receive} />
            <Route path="/contacts">
              <Contacts />
            </Route>
            <Route path="/swap" component={Swap} />
            <Route path="/collectibles" component={Collectibles} />
            <Route path="/settings" component={SettingsList} />
            <Route path="/settings/general" component={GeneralSettings} />
            <Route path="/settings/network">
              <SwitchNetworks activeNetwork={activeNetwork} />
            </Route>
            <Route path="/settings/network/add" component={AddCustomNetwork} />
            <Route path="/settings/advanced" component={AdvancedList} />
            <Route
              path="/settings/advanced/permissions"
              component={DomainPermissions}
            />
            <Route path="/settings/security" component={SecurityAndPrivacy} />
            <Route path="/settings/about" component={SettingsAbout} />

            <Route path="/token" component={TokenPage} />
            <Route path="/token/add" component={AddOrUpdateCustomToken} />
          </Router>
        </div>
      )}
      {!signedIn && (
        <div className="flex flex-col justify-center items-center h-full">
          <Router hook={useHashLocation}>
            <Route path="/" component={Unlock} />
          </Router>
        </div>
      )}
    </div>
  )
}

export default MainPage
