export const LEDGER_VENDOR_ID = 0x2c97;
export const LEDGER_CLA = 0xE0;

// Target IDs
export const TARGET_NANOS = 0x31100002;
export const TARGET_NANOS_14 = 0x31100003;  // v1.4
export const TARGET_NANOS_15 = 0x31100004;  // v1.5+
export const TARGET_NANOX = 0x33000004;
export const TARGET_NANOSP = 0x33100004;
export const TARGET_STAX = 0x33200004;
export const TARGET_FLEX = 0x33300004;

// Product IDs for device detection
export const PRODUCT_IDS = {
  NANO_S: [0x0001, 0x1000],
  NANO_X: [0x0004, 0x4000],
  NANO_SP: [0x0005, 0x5000],
  STAX: [0x0006, 0x6000],
  FLEX: [0x0007, 0x7000]
} as const;

// SCP Constants
export const SCP_MAC_LENGTH = 0x0E;

export const TARGET_DEVICES = [
  { id: TARGET_NANOS, name: 'Nano S' },
  { id: TARGET_NANOS_14, name: 'Nano S (v1.4)' },
  { id: TARGET_NANOS_15, name: 'Nano S (v1.5+)' },
  { id: TARGET_NANOX, name: 'Nano X' },
  { id: TARGET_NANOSP, name: 'Nano S Plus' },
  { id: TARGET_STAX, name: 'Stax' },
  { id: TARGET_FLEX, name: 'Flex' }
] as const;