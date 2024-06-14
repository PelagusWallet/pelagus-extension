type OldState = {
  networks: {
    blockInfo: unknown
    evmNetworks: Record<string, unknown>
  }
}

type NewState = {
  networks: {
    blockInfo: unknown
    evmNetworks: Record<string, unknown>
    testNetworksWithAvailabilityFlag: Record<string, unknown>
  }
}

export default (prevState: Record<string, unknown>): NewState => {
  const typedPrevState = prevState as OldState

  return {
    ...prevState,
    networks: {
      ...typedPrevState.networks,
      testNetworksWithAvailabilityFlag: {},
    },
  }
}
