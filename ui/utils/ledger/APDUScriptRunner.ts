import { WebHIDTransport } from './WebHIDTransport';
import { SecureChannelProtocol } from './SecureChannelProtocol';

export interface APDUResult {
  apdu: string;
  response?: string;
  error?: string;
  success: boolean;
}

export type ProgressCallback = (current: number, total: number) => void;

export class APDUScriptRunner {
  private transport: WebHIDTransport;
  private scp: SecureChannelProtocol | null = null;

  constructor() {
    this.transport = new WebHIDTransport();
  }

  async connect(): Promise<boolean> {
    await this.transport.connect();
    return true;
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }

  async initializeSCP(targetId: number, rootPrivateKey?: Uint8Array): Promise<boolean> {
    this.scp = new SecureChannelProtocol();
    await this.scp.initialize(this.transport, targetId, rootPrivateKey);
    return true;
  }

  async runScript(
    scriptContent: string,
    useSCP = false,
    onProgress?: ProgressCallback,
    timeoutMs: number = 30000
  ): Promise<APDUResult[]> {
    const lines = scriptContent.split('\n');
    const results: APDUResult[] = [];

    let lineNum = 0;
    for (const line of lines) {
      lineNum++;

      // Skip empty lines and comments
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse hex APDU
      const apduHex = trimmed.replace(/\s+/g, '');
      if (!/^[0-9a-fA-F]+$/.test(apduHex) || apduHex.length < 10) {
        console.warn(`Line ${lineNum}: Invalid APDU: ${trimmed}`);
        continue;
      }

      // Convert to bytes
      const apdu = new Uint8Array(
        apduHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );

      let finalApdu: Uint8Array;
      let didWrap = false;

      if (useSCP && this.scp && this.scp.isSecure()) {
        // Wrap data part with SCP (like Python runScript)
        const apduData = apdu.slice(5);
        const wrappedData = await this.scp.wrap(apduData);
        didWrap = wrappedData.length > 0;

        // Reconstruct APDU with wrapped data
        finalApdu = new Uint8Array(5 + wrappedData.length);
        // Use original CLA, but try manager fallback CLA=0xF0 for INS=0x00 if needed
        finalApdu[0] = apdu[0]; // CLA
        finalApdu[1] = apdu[1]; // INS
        finalApdu[2] = apdu[2]; // P1
        finalApdu[3] = apdu[3]; // P2
        finalApdu[4] = wrappedData.length; // Lc
        finalApdu.set(wrappedData, 5);

      } else {
        finalApdu = apdu;
      }

      // Send APDU
      console.log(`=> ${this.bytesToHex(finalApdu)}`);

      try {
        let response = await this.transport.exchange(finalApdu, timeoutMs);
        
        // Unwrap response if using SCP
        if (useSCP && this.scp && this.scp.isSecure() && didWrap) {
          const responseData = response.slice(0, -2); // Remove SW
          const sw = response.slice(-2);
          
          if (responseData.length > 0) {
            const unwrapped = await this.scp.unwrap(responseData);
            response = new Uint8Array(unwrapped.length + 2);
            response.set(unwrapped);
            response.set(sw, unwrapped.length);
          }
        }
        
        console.log(`<= ${this.bytesToHex(response)}`);
        
        results.push({
          apdu: apduHex,
          response: this.bytesToHex(response),
          success: true
        });
        
        if (onProgress) {
          onProgress(lineNum, lines.length);
        }
        
        // Small delay between commands
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error on line ${lineNum}: ${errorMessage}`);
        results.push({
          apdu: apduHex,
          error: errorMessage,
          success: false
        });
        
        // Continue or stop based on error type
        if (errorMessage.includes('6') && errorMessage.length === 4) {
          // Device error, might want to continue
          continue;
        } else {
          // Transport error, stop
          break;
        }
      }
    }
    
    return results;
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  getDeviceName(): string | undefined {
    return this.transport.getDeviceName();
  }

  hasSCP(): boolean {
    return this.scp !== null && this.scp.isSecure();
  }

  getTransport(): WebHIDTransport {
    return this.transport;
  }

  getSCP(): SecureChannelProtocol | null {
    return this.scp;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}