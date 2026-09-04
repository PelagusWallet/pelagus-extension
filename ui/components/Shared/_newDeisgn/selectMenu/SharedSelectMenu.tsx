import React, { ReactElement } from "react"

import SharedSelect, { Option } from "../../SharedSelect"

type Props = {
  direction: "top" | "bottom"
  options: Option[]
  onSelectOption?: (
    value: Option
  ) => void | React.Dispatch<React.SetStateAction<Option>>
  selectedOption?: Option
  label?: string
  width?: number
}

export default function SharedSelectMenu({
  direction = "bottom",
  options = [],
  onSelectOption = () => {},
  label,
  width,
  selectedOption,
}: Props): ReactElement {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedOption?.value)
  )

  return (
    <SharedSelect
      placement={direction}
      options={options}
      onChange={(value) => {
        const option = options.find((candidate) => candidate.value === value)
        if (option) onSelectOption(option)
      }}
      defaultIndex={selectedIndex}
      label={label}
      ariaLabel={label}
      width={width ?? "100%"}
    />
  )
}

SharedSelectMenu.defaultProps = {
  direction: "bottom",
  options: [],
  onSelectOption: () => {},
  selectedOption: undefined,
  label: undefined,
  width: undefined,
}
