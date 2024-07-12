import React, { useState } from "react"
import userEvent from "@testing-library/user-event"
import { FungibleAsset } from "@pelagus/pelagus-background/assets"
import { hardcodedMainCurrencySign } from "@pelagus/pelagus-background/redux-slices/utils/constants"
import SharedAssetInput from "../SharedAssetInput"
import { renderWithProviders } from "../../../tests/test-utils"
import { QuaiNetworkGA } from "@pelagus/pelagus-background/constants/networks/networks"

const label = "Test label"
const asset: FungibleAsset = {
  symbol: "FAKE",
  name: "Fake token",
  decimals: 2,
  metadata: {
    tokenLists: [
      {
        name: "",
        url: "",
      },
    ],
    websiteURL: "",
    verified: true,
  },
}
const assetsAndAmounts = [
  {
    asset,
    amount: 100n,
    localizedDecimalAmount: "1",
  },
  {
    asset: {
      symbol: "TST",
      name: "Test token",
      decimals: 2,
      metadata: {
        tokenLists: [
          {
            name: "",
            url: "",
          },
        ],
        websiteURL: "",
        verified: true,
      },
    },
    amount: 300n,
    localizedDecimalAmount: "3",
  },
  {
    asset: {
      symbol: "UTT",
      name: "Unverified token",
      decimals: 2,
      metadata: {
        tokenLists: [],
        websiteURL: "",
        verified: false,
      },
    },
    amount: 300n,
    localizedDecimalAmount: "3",
  },
]

function SharedAssetInputWithState({
  initialAmount = "",
}: {
  initialAmount?: string
}) {
  const [amount, setAmount] = useState(initialAmount)
  const [currentAsset, setCurrent] = useState(asset)
  return (
    <SharedAssetInput
      currentNetwork={QuaiNetworkGA}
      selectedAsset={currentAsset}
      assetsAndAmounts={assetsAndAmounts}
      label={label}
      amount={amount}
      onAmountChange={(value) => setAmount(value)}
      showMaxButton
      showPriceDetails
      mainCurrencySign={hardcodedMainCurrencySign}
      amountMainCurrency="1"
      onAssetSelect={(value) => setCurrent(value)}
    />
  )
}

describe("SharedAssetInput", () => {
  test("should renderWithProviders component", async () => {
    const ui = renderWithProviders(
      <SharedAssetInput
        currentNetwork={QuaiNetworkGA}
        selectedAsset={undefined}
        assetsAndAmounts={[]}
        label={label}
      />
    )

    expect(ui.getByText(label)).toBeInTheDocument()
    expect(ui.getByText("Select token")).toBeInTheDocument()
  })

  test("should display predefined asset", () => {
    const ui = renderWithProviders(<SharedAssetInputWithState />)

    expect(ui.getByText("FAKE")).toBeInTheDocument()
    expect(ui.getByText("Balance: 1")).toBeInTheDocument()
  })

  test("should allow to open assets selector", async () => {
    const ui = renderWithProviders(<SharedAssetInputWithState />)

    const assetButton = ui.getByText("FAKE")

    await userEvent.click(assetButton)
    expect(ui.queryByText("Select token")).toBeVisible()
  })

  test("should allow to search for assets with a searchbox", async () => {
    const ui = renderWithProviders(<SharedAssetInputWithState />)
    const assetButton = ui.getByText("FAKE")

    await userEvent.click(assetButton)
    expect(ui.queryByText("Fake token")).toBeVisible()
    expect(ui.queryByText("Test token")).toBeVisible()

    const searchbox = ui.getByPlaceholderText("Search by name or address")
    expect(searchbox).toHaveValue("")

    await userEvent.type(searchbox, "Fake")

    expect(searchbox).toHaveValue("Fake")
    expect(ui.queryByText("Fake token")).toBeVisible()
    expect(ui.queryByText("Test token")).not.toBeInTheDocument()
  })

  test("should allow to search for unverified assets with a searchbox", async () => {
    const ui = renderWithProviders(<SharedAssetInputWithState />)
    const assetButton = ui.getByText("FAKE")

    await userEvent.click(assetButton)
    expect(ui.queryByText("Unverified token")).toBeInTheDocument()

    const searchbox = ui.getByPlaceholderText("Search by name or address")
    expect(searchbox).toHaveValue("")

    await userEvent.type(searchbox, "Unverified")

    expect(searchbox).toHaveValue("Unverified")
    expect(ui.queryByText("Unverified token")).not.toBeInTheDocument()
  })

  test("should allow to select different asset", async () => {
    const ui = renderWithProviders(<SharedAssetInputWithState />)
    const assetButton = ui.getByText("FAKE")
    await userEvent.click(assetButton)

    const anotherToken = ui.getByText("Test token")
    await userEvent.click(anotherToken)

    expect(anotherToken).not.toBeVisible() // menu should autoclose
    expect(assetButton).toBeVisible()
    expect(assetButton).toHaveTextContent("TST")
  })

  test("should display asset balance", () => {
    const ui = renderWithProviders(<SharedAssetInputWithState />)

    expect(ui.queryByText("Balance: 1")).toBeInTheDocument()
  })

  test("should allow to select max amount of the asset", async () => {
    const ui = renderWithProviders(<SharedAssetInputWithState />)
    const inputElement = ui.getByLabelText(label)
    const maxButton = ui.getByText("Max")

    expect(inputElement).toHaveDisplayValue("")
    await userEvent.click(maxButton)
    expect(inputElement).toHaveDisplayValue("1")
  })

  test("should be able to type asset amount", async () => {
    const ui = renderWithProviders(<SharedAssetInputWithState />)
    const inputElement = ui.getByLabelText(label)

    expect(inputElement).toHaveDisplayValue("")
    await userEvent.type(inputElement, "0.5")
    expect(inputElement).toHaveDisplayValue("0.5")
  })

  test("should display asset price", () => {
    const ui = renderWithProviders(
      <SharedAssetInputWithState initialAmount="1" />
    )

    expect(ui.getByText("$1")).toBeVisible()
  })

  test("should show insufficient balance error", async () => {
    const ui = renderWithProviders(<SharedAssetInputWithState />)
    const inputElement = ui.getByLabelText(label)

    await userEvent.type(inputElement, "10")
    const errorMessage = ui.getByText("Insufficient balance")

    expect(errorMessage).toBeVisible()
  })

  test("should be able to disable assets selector", async () => {
    const ui = renderWithProviders(
      <SharedAssetInput
        currentNetwork={QuaiNetworkGA}
        selectedAsset={asset}
        assetsAndAmounts={assetsAndAmounts}
        label={label}
        disableDropdown
      />
    )

    const assetButton = ui.getByText("FAKE")

    expect(assetButton).toHaveAttribute("disabled")
    await userEvent.click(assetButton)
    expect(ui.queryByText("Select token")).not.toBeInTheDocument()
  })
})
