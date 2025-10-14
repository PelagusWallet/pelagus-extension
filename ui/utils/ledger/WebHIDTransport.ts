import { LEDGER_VENDOR_ID } from './constants';

export class WebHIDTransport {
  private device: HIDDevice | null = null;
  private channel = 0x0101;

  async connect(): Promise<HIDDevice> {
    // First check if we already have permission to any connected devices
    const existingDevices = await navigator.hid.getDevices();
    console.log("Existing permitted devices:", existingDevices.length);
    
    // Filter for Ledger devices
    const ledgerDevices = existingDevices.filter(d => d.vendorId === LEDGER_VENDOR_ID);
    
    let device: HIDDevice | null = null;
    
    if (ledgerDevices.length > 0) {
      console.log("Found existing Ledger device, using it");
      device = ledgerDevices[0];
    } else {
      console.log("Requesting device permission...");
      const devices = await navigator.hid.requestDevice({
        filters: [{ vendorId: LEDGER_VENDOR_ID }]
      });

      if (devices.length === 0) {
        throw new Error("No Ledger device selected");
      }
      device = devices[0];
    }

    this.device = device;
    
    console.log(`Device state - opened: ${this.device.opened}, product: ${this.device.productName}`);
    
    // If device is already opened, close and reopen to ensure clean state
    if (this.device.opened) {
      console.log("Device already opened, closing and reopening for clean state...");
      await this.device.close();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log("Opening device...");
    try {
      await this.device.open();
      console.log("Device opened successfully");
      
      // Clear any pending input reports
      const clearInputs = () => {
        // Just set up the listener to drain any pending reports
      };
      this.device.addEventListener('inputreport', clearInputs);
      
      // Give the device a moment to initialize after opening
      await new Promise(resolve => setTimeout(resolve, 200));
      
      this.device.removeEventListener('inputreport', clearInputs);
      console.log("Device ready for communication");
    } catch (error) {
      console.error("Failed to open device:", error);
      throw new Error(`Failed to open device: ${error}`);
    }

    console.log(`Connected to ${this.device.productName}`);
    return this.device;
  }

  async disconnect(): Promise<void> {
    if (this.device && this.device.opened) {
      await this.device.close();
      this.device = null;
    }
  }

  async exchange(apdu: Uint8Array, timeoutMs: number = 30000): Promise<Uint8Array> {
    if (!this.device) {
      throw new Error("Device not connected");
    }
    const response = await this.sendAndReceive(apdu, timeoutMs);
    return response;
  }

  private async sendAndReceive(apdu: Uint8Array, timeoutMs: number = 30000): Promise<Uint8Array> {
    if (!this.device) {
      throw new Error("Device not connected");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.device?.removeEventListener('inputreport', handleInput);
        reject(new Error('Response timeout'));
      }, timeoutMs);

      const frames: Uint8Array[] = [];
      let expectedLength: number | null = null;

      const handleInput = (event: HIDInputReportEvent) => {
        const frame = new Uint8Array(event.data.buffer);
        frames.push(frame);

        if (frames.length === 1) {
          expectedLength = (frame[5] << 8) | frame[6];
        }

        if (expectedLength === null) return;

        const received = frames.reduce((sum, _, i) => 
          sum + (i === 0 ? Math.min(expectedLength!, 57) : Math.min(expectedLength! - sum, 59)), 0);

        if (received >= expectedLength) {
          clearTimeout(timeout);
          this.device?.removeEventListener('inputreport', handleInput);
          resolve(this.unwrapFrames(frames, expectedLength!));
        }
      };

      this.device!.addEventListener('inputreport', handleInput);
      this.sendFrames(apdu).catch(reject);
    });
  }

  private async sendFrames(apdu: Uint8Array): Promise<void> {
    if (!this.device) {
      throw new Error("Device not connected");
    }

    let offset = 0;
    let sequence = 0;

    // First frame - 64 bytes (or 65 with report ID)
    // Some devices need the report ID prepended, making it 65 bytes total
    const frameSize = 64;
    const firstFrame = new Uint8Array(frameSize);
    firstFrame[0] = (this.channel >> 8) & 0xff;
    firstFrame[1] = this.channel & 0xff;
    firstFrame[2] = 0x05; // APDU tag
    firstFrame[3] = (sequence >> 8) & 0xff;
    firstFrame[4] = sequence & 0xff;
    firstFrame[5] = (apdu.length >> 8) & 0xff;
    firstFrame[6] = apdu.length & 0xff;

    const firstLen = Math.min(apdu.length, 57);
    firstFrame.set(apdu.slice(0, firstLen), 7);
    
    try {
      // Log the frame we're trying to send
      console.log("Sending frame:", this.bytesToHex(firstFrame));
      console.log("Device collections:", this.device.collections);
      
      // Check if device has output reports
      const hasOutputReports = this.device.collections.some(c => 
        c.outputReports && c.outputReports.length > 0
      );
      
      if (!hasOutputReports) {
        console.warn("Device has no output reports defined, trying anyway...");
      }
      
      // Try with report ID 0 (most common for Ledger devices)
      await this.device.sendReport(0, firstFrame);
    } catch (error) {
      console.error("Failed to send first frame:", error);
      console.error("Device state:", { 
        opened: this.device?.opened,
        collections: this.device?.collections,
        productName: this.device?.productName
      });
      
      // Try without report ID (some devices don't use report IDs)
      console.log("Retrying without report ID...");
      try {
        await this.device.sendReport(0x00, firstFrame);
      } catch (error2) {
        console.error("Also failed without report ID:", error2);
        throw error;
      }
    }
    
    offset += firstLen;
    sequence++;

    // Continuation frames
    while (offset < apdu.length) {
      const frame = new Uint8Array(64);
      frame[0] = (this.channel >> 8) & 0xff;
      frame[1] = this.channel & 0xff;
      frame[2] = 0x05;
      frame[3] = (sequence >> 8) & 0xff;
      frame[4] = sequence & 0xff;

      const len = Math.min(apdu.length - offset, 59);
      frame.set(apdu.slice(offset, offset + len), 5);
      await this.device.sendReport(0, frame);
      offset += len;
      sequence++;
    }
  }

  private unwrapFrames(frames: Uint8Array[], totalLength: number): Uint8Array {
    const result = new Uint8Array(totalLength);
    let offset = 0;

    // First frame - data starts at byte 7
    const firstLen = Math.min(totalLength, 57);
    result.set(frames[0].slice(7, 7 + firstLen), 0);
    offset += firstLen;

    // Continuation frames - data starts at byte 5
    for (let i = 1; i < frames.length && offset < totalLength; i++) {
      const len = Math.min(totalLength - offset, 59);
      result.set(frames[i].slice(5, 5 + len), offset);
      offset += len;
    }

    return result;
  }

  isConnected(): boolean {
    return this.device !== null && this.device.opened;
  }

  getDeviceName(): string | undefined {
    return this.device?.productName;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}