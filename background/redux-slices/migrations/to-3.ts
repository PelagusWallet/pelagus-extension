type OldState = {
  ui: {
    [sliceKey: string]: unknown
  }
  [otherSlice: string]: unknown
}

type NewState = {
  ui: {
    showingImportPrivateKeyModal: {
      isOpen: boolean
      category: "Quai Account" | "Qi Wallet"
    }
    [sliceKey: string]: unknown
  }
  [otherSlice: string]: unknown
}

export default (oldState: Record<string, unknown>): NewState => {
  const prevState = oldState as OldState

  return {
    ...prevState,
    ui: {
      ...prevState.ui,
      showingImportPrivateKeyModal: {
        isOpen: false,
        category: "Quai Account",
      },
    },
  }
}
