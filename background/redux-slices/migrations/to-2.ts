type OldState = {
  activities: {
    activities: {
      [address: string]: {
        [chainID: string]: unknown[]
      }
    }
  }
}
type NewState = {
  activities: {
    activities: {
      [address: string]: {
        [chainID: string]: unknown[]
      }
    }
    utxoActivities: {
      [paymentCOde: string]: {
        [chainID: string]: unknown[]
      }
    }
  }
}
export default (prevState: Record<string, unknown>): NewState => {
  const typedPrevState = prevState as OldState
  return {
    ...prevState,
    activities: {
      ...typedPrevState.activities,
      utxoActivities: {},
    },
  }
}
