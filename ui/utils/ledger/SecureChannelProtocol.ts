import * as secp256k1 from '@noble/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { WebHIDTransport } from './WebHIDTransport';
import { SCP_MAC_LENGTH } from './constants';

// Type declarations for aes-js v3
declare module 'aes-js' {
  export namespace ModeOfOperation {
    export class cbc {
      constructor(key: Uint8Array, iv: Uint8Array);
      encrypt(plaintext: Uint8Array): Uint8Array;
      decrypt(ciphertext: Uint8Array): Uint8Array;
    }
  }
}

// @ts-ignore - aes-js v3 has no TypeScript types
import * as aesjs from 'aes-js';

// Configure Noble secp256k1 with HMAC
secp256k1.utils.hmacSha256Sync = (key: Uint8Array, ...messages: Uint8Array[]) => {
  const h = hmac.create(sha256, key);
  messages.forEach(msg => h.update(msg));
  return h.digest();
};

export class SecureChannelProtocol {
  private scpVersion = 3;
  private scp_enc_key: Uint8Array | null = null;
  private scp_mac_key: Uint8Array | null = null;
  private scp_enc_iv = new Uint8Array(16);
  private scp_mac_iv = new Uint8Array(16);
  private secure = false;
  private scpv3 = false; // For MODE_SIV variant

  private aesCbcEncryptNoPadding(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
    // IMPORTANT: aes-js modifies the IV in place, so we must copy it
    const ivCopy = new Uint8Array(iv);
    const cipher = new aesjs.ModeOfOperation.cbc(key, ivCopy);
    const encrypted = cipher.encrypt(data);
    return new Uint8Array(encrypted);
  }

  private aesCbcDecryptNoPadding(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
    // IMPORTANT: aes-js modifies the IV in place, so we must copy it
    const ivCopy = new Uint8Array(iv);
    const cipher = new aesjs.ModeOfOperation.cbc(key, ivCopy);
    const decrypted = cipher.decrypt(data);
    return new Uint8Array(decrypted);
  }

  /**
   * Derive key exactly as Python scp_derive_key
   */
  private async deriveKey(ecdhSecret: Uint8Array, keyIndex: number): Promise<Uint8Array> {
    if (this.scpv3) {
      throw new Error("SCP v3 MODE_SIV not implemented");
    }
    
    let retry = 0;
    const SECP256K1_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    
    while (true) {
      // di = sha256(keyindex || retry || ecdh_secret)
      const input = new Uint8Array(5 + ecdhSecret.length);
      const view = new DataView(input.buffer);
      view.setUint32(0, keyIndex, false); // big-endian
      input[4] = retry;
      input.set(ecdhSecret, 5);
      
      const hashArray = sha256(input);
      
      // Check if hash < secp256k1 order
      const hashBigInt = BigInt('0x' + Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join(''));
      
      if (hashBigInt < SECP256K1_ORDER) {
        // Use this hash as a private key to generate public key, then hash that
        const pubKey = secp256k1.getPublicKey(hashArray, false); // uncompressed
        const keyHash = sha256(pubKey);
        return keyHash;
      }
      
      retry++;
      if (retry > 255) {
        throw new Error("Failed to derive key within order bounds");
      }
    }
  }

  /**
   * Initialize SCP with getDeployedSecretV2 flow (exact Python implementation)
   * 
   * When no rootPrivateKey is provided, generates a random one (test mode).
   * This works on devices in developer/recovery mode which accept any key.
   */
  async initialize(transport: WebHIDTransport, targetId: number, rootPrivateKey?: Uint8Array): Promise<boolean> {
    // Check target ID supports SCP v2
    if ((targetId & 0xF) < 2) {
      throw new Error("Target ID does not support SCP V2");
    }

    // Generate random private key if none provided (test/developer mode)
    // This matches Python's behavior: when --scp is used without --rootPrivateKey,
    // it generates a random key that works with devices in developer mode
    if (!rootPrivateKey) {
      rootPrivateKey = secp256k1.utils.randomPrivateKey();
      console.log("Generated random test private key (developer mode)");
      
      // Log the public key like Python does
      const testPublic = secp256k1.getPublicKey(rootPrivateKey, false);
      console.log("Generated random root public key:", this.bytesToHex(testPublic));
    }

    // Step 1: Identify (validate target ID)
    const targetIdBytes = new Uint8Array(4);
    new DataView(targetIdBytes.buffer).setUint32(0, targetId, false);
    
    const identifyApdu = new Uint8Array([0xE0, 0x04, 0x00, 0x00, 0x04, ...targetIdBytes]);
    console.log("Sending identify APDU:", this.bytesToHex(identifyApdu));
    
    try {
      const response = await transport.exchange(identifyApdu);
      console.log("Identify response:", this.bytesToHex(response));
      console.log("Target ID validated");
    } catch (error) {
      console.error("Failed to identify target:", error);
      throw new Error(`Failed to identify target: ${error}`);
    }

    // Step 2: Initialize authentication with nonce
    const nonce = crypto.getRandomValues(new Uint8Array(8));
    const initAuthApdu = new Uint8Array([0xE0, 0x50, 0x00, 0x00, 0x08, ...nonce]);
    const authInfo = await transport.exchange(initAuthApdu);
    
    const deviceNonce = authInfo.slice(4, 12);
    console.log("Received device nonce");

    // Get test master public key
    const testMasterPublic = secp256k1.getPublicKey(rootPrivateKey, false); // uncompressed
    console.log("Using test master key:", this.bytesToHex(testMasterPublic));
    
    // Step 3: Send test master certificate (self-signed)
    const dataToSign1 = new Uint8Array([0x01, ...testMasterPublic]);
    const msgHash1 = sha256(dataToSign1);
    const signature1 = secp256k1.signSync(msgHash1, rootPrivateKey, { der: true, canonical: true });
    
    console.log("Signature1 type:", typeof signature1, "length:", signature1?.length);
    
    // signSync with der:true already returns DER
    const sig1DER: Uint8Array = signature1 as Uint8Array;
    
    console.log("Master cert signature (DER):", this.bytesToHex(sig1DER));
    
    // Build certificate: [len(pubkey)] + pubkey + [len(signature)] + signature
    const masterCert = new Uint8Array(1 + testMasterPublic.length + 1 + sig1DER.length);
    masterCert[0] = testMasterPublic.length;
    masterCert.set(testMasterPublic, 1);
    masterCert[1 + testMasterPublic.length] = sig1DER.length;
    masterCert.set(sig1DER, 2 + testMasterPublic.length);
    
    const certApdu = new Uint8Array([0xE0, 0x51, 0x00, 0x00, masterCert.length, ...masterCert]);
    console.log("Sending master cert APDU:", this.bytesToHex(certApdu));
    const masterCertResponse = await transport.exchange(certApdu);
    const masterCertSW = (masterCertResponse[masterCertResponse.length - 2] << 8) | masterCertResponse[masterCertResponse.length - 1];
    console.log("Master cert response SW:", masterCertSW.toString(16).padStart(4, '0'));
    if (masterCertSW !== 0x9000) {
      console.error("❌ Master certificate rejected!");
      throw new Error(`Master certificate rejected with SW: ${masterCertSW.toString(16)}`);
    }
    console.log("✅ Master certificate accepted");
    
    // Step 4: Generate and send ephemeral certificate
    const ephemeralPrivate = secp256k1.utils.randomPrivateKey();
    const ephemeralPublic = secp256k1.getPublicKey(ephemeralPrivate, false);
    console.log("Using ephemeral key:", this.bytesToHex(ephemeralPublic));
    
    const dataToSign2 = new Uint8Array([0x11, ...nonce, ...deviceNonce, ...ephemeralPublic]);
    const msgHash2 = sha256(dataToSign2);
    const signature2 = secp256k1.signSync(msgHash2, rootPrivateKey, { der: true, canonical: true });
    
    // signSync with der:true already returns DER
    const sig2DER: Uint8Array = signature2 as Uint8Array;
    
    console.log("Ephemeral cert signature (DER):", this.bytesToHex(sig2DER));
    
    // Build ephemeral certificate
    const ephCert = new Uint8Array(1 + ephemeralPublic.length + 1 + sig2DER.length);
    ephCert[0] = ephemeralPublic.length;
    ephCert.set(ephemeralPublic, 1);
    ephCert[1 + ephemeralPublic.length] = sig2DER.length;
    ephCert.set(sig2DER, 2 + ephemeralPublic.length);
    
    const ephCertApdu = new Uint8Array([0xE0, 0x51, 0x80, 0x00, ephCert.length, ...ephCert]);
    console.log("Sending ephemeral cert APDU:", this.bytesToHex(ephCertApdu));
    const ephCertResponse = await transport.exchange(ephCertApdu);
    const ephCertSW = (ephCertResponse[ephCertResponse.length - 2] << 8) | ephCertResponse[ephCertResponse.length - 1];
    console.log("Ephemeral cert response SW:", ephCertSW.toString(16).padStart(4, '0'));
    if (ephCertSW !== 0x9000) {
      console.error("❌ Ephemeral certificate rejected!");
      throw new Error(`Ephemeral certificate rejected with SW: ${ephCertSW.toString(16)}`);
    }
    console.log("✅ Ephemeral certificate accepted");

    // Step 5: Get device certificate(s)
    let lastDevicePublicKey = testMasterPublic;
    
    // First certificate
    const getCert1Apdu = new Uint8Array([0xE0, 0x52, 0x00, 0x00, 0x00]);
    const cert1 = await transport.exchange(getCert1Apdu);

    console.log("Cert1 response length:", cert1.length);
    console.log("Cert1 response hex:", this.bytesToHex(cert1));

    if (cert1.length >= 2) {
      const sw = (cert1[cert1.length - 2] << 8) | cert1[cert1.length - 1];
      if (sw === 0x9000 && cert1.length > 2) {
        const certData = cert1.slice(0, -2); // Remove status word
        console.log("Cert1 data length:", certData.length);
        console.log("Cert1 data (first 20 bytes):", this.bytesToHex(certData.slice(0, 20)));
        
        if (certData.length > 0) {
          // Parse certificate structure
          // Format appears to be: [1 byte header] [7 bytes zeros] [1 byte key len] [key] [1 byte sig len] [sig]
          let offset = 0;
          
          // Skip first byte and 7 zeros
          if (certData[0] === 0x07) {
            offset = 8; // Skip 0x07 and 7 zeros
          } else {
            // Try different format: [total_len] [header_len] [header] [key_len] [key] [sig_len] [sig]
            const totalLen = certData[offset];
            offset++;
            console.log("Certificate total length:", totalLen);
            
            if (offset < certData.length) {
              const headerLen = certData[offset];
              offset++;
              console.log("Header length:", headerLen);
              offset += headerLen; // Skip header
            }
          }
          
          // Now we should be at public key length
          if (offset < certData.length) {
            const keyLen = certData[offset];
            offset++;
            console.log("Public key length:", keyLen, "at offset:", offset - 1);
            
            if (keyLen === 0x41 && offset + keyLen <= certData.length) {
              const devicePublicKey = certData.slice(offset, offset + keyLen);
              console.log("Extracted device public key:", this.bytesToHex(devicePublicKey));
              
              // Check if this is a valid uncompressed public key
              if (devicePublicKey.length === 65 && devicePublicKey[0] === 0x04) {
                lastDevicePublicKey = devicePublicKey;
                console.log("✅ Got device master public key!");
              }
            }
          }
        }
      } else if (sw === 0x6604) {
        console.log("Certificate chain unavailable (0x6604) - user key mode");
        console.log("Falling back to test master public key");
        // In user key mode, we use our own test master public key for ECDH
        // This is the fallback behavior when device doesn't provide certificates
      } else if (sw !== 0x9000) {
        console.log(`Unexpected SW on cert1: ${sw.toString(16)} - continuing in user key mode`);
      }
    }
    
    // Try second certificate (ephemeral from device)
    try {
      const getCert2Apdu = new Uint8Array([0xE0, 0x52, 0x80, 0x00, 0x00]);
      const cert2 = await transport.exchange(getCert2Apdu);
      
      console.log("Cert2 response length:", cert2.length);
      console.log("Cert2 response hex:", this.bytesToHex(cert2));
      
      if (cert2.length >= 2) {
        const sw = (cert2[cert2.length - 2] << 8) | cert2[cert2.length - 1];
        if (sw === 0x9000 && cert2.length > 2) {
          const certData = cert2.slice(0, -2);
          console.log("Cert2 data length:", certData.length);
          console.log("Cert2 data (first 20 bytes):", this.bytesToHex(certData.slice(0, 20)));
          
          if (certData.length > 0) {
            // Parse ephemeral certificate - simpler format
            let offset = 0;
            
            // Skip first byte if it's 0x00
            if (certData[0] === 0x00) {
              offset = 1;
            }
            
            // Get public key length
            if (offset < certData.length) {
              const keyLen = certData[offset];
              offset++;
              console.log("Ephemeral key length:", keyLen, "at offset:", offset - 1);
              
              if (keyLen === 0x41 && offset + keyLen <= certData.length) {
                const ephemeralDeviceKey = certData.slice(offset, offset + keyLen);
                console.log("Extracted ephemeral device key:", this.bytesToHex(ephemeralDeviceKey));
                
                // Check if this is a valid public key
                if (ephemeralDeviceKey.length === 65 && ephemeralDeviceKey[0] === 0x04) {
                  lastDevicePublicKey = ephemeralDeviceKey;
                  console.log("✅ Got device ephemeral public key! Using this for ECDH.");
                }
              }
            }
          }
        } else if (sw === 0x6604) {
          console.log("Ephemeral certificate unavailable (0x6604) - user key mode");
          // Device ephemeral key is not available, we'll use the main device key
        } else if (sw !== 0x9000) {
          console.log(`Unexpected SW on cert2: ${sw.toString(16)} - continuing in user key mode`);
        }
      }
    } catch (e) {
      // Second certificate is optional
      console.log("No second certificate or error:", e);
    }

    // Step 6: Commit device ECDH channel
    const commitApdu = new Uint8Array([0xE0, 0x53, 0x00, 0x00, 0x00]);
    await transport.exchange(commitApdu);
    console.log("ECDH channel committed");

    // Step 7: Compute shared secret and derive keys
    // When no device certificates are returned (6604 error), use test master public key
    // This is the fallback mode as per Python implementation
    console.log("Computing ECDH with key:", this.bytesToHex(lastDevicePublicKey));
    console.log("Using ephemeral private key for ECDH");
    
    // The ECDH is always done with our ephemeral private key and the last device public key
    // When no certificates are returned, this is our own test master public key (fallback mode)
    const sharedPoint = secp256k1.getSharedSecret(ephemeralPrivate, lastDevicePublicKey, true); // compressed 33 bytes

    // The compressed point is 0x02/0x03 + X coordinate (33 bytes total)
    // We must hash this to get the same secret as Python
    const ecdhSecret = sha256(sharedPoint);
    console.log("ECDH secret (SHA256 of compressed point, 32 bytes):", this.bytesToHex(ecdhSecret));

    // Derive encryption and MAC keys as per Python implementation
    if ((targetId & 0xF) >= 0x3) {
      // For newer devices (SCP v3), derive keys using the ECDH secret
      const encKeyFull = await this.deriveKey(ecdhSecret, 0);
      this.scp_enc_key = encKeyFull.slice(0, 16);  // Use only first 16 bytes
      this.scp_enc_iv = new Uint8Array(16); // zeros
      
      const macKeyFull = await this.deriveKey(ecdhSecret, 1);
      this.scp_mac_key = macKeyFull.slice(0, 16);  // Use only first 16 bytes
      this.scp_mac_iv = new Uint8Array(16); // zeros
      
      this.scpVersion = 3;
      this.secure = true;
      
      console.log("SCP v3 initialized with derived keys");
      console.log("Enc key (first 4 bytes):", this.bytesToHex(this.scp_enc_key.slice(0, 4)));
      console.log("MAC key (first 4 bytes):", this.bytesToHex(this.scp_mac_key.slice(0, 4)));
    } else {
      // For older devices (SCP v2), use first 16 bytes of ECDH secret directly
      this.scp_enc_key = ecdhSecret.slice(0, 16);
      this.scp_mac_key = ecdhSecret.slice(0, 16);  // Same key for both in v2
      this.scp_enc_iv = new Uint8Array(16);
      this.scp_mac_iv = new Uint8Array(16);
      this.scpVersion = 2;
      this.secure = true;
      console.log("SCP v2 initialized");
    }
    
    return true;
  }

  /**
   * Wrap data with SCP (exact match to Python scpWrap)
   */
  async wrap(data: Uint8Array): Promise<Uint8Array> {
    if (!this.secure || !data || data.length === 0 || !this.scp_enc_key || !this.scp_mac_key) {
      return data;
    }

    if (this.scpv3) {
      throw new Error("SCP MODE_SIV not implemented");
    }

    console.log("SCP wrap - input data len:", data.length, "hex:", this.bytesToHex(data));
    console.log("SCP wrap - enc_iv:", this.bytesToHex(this.scp_enc_iv), "mac_iv:", this.bytesToHex(this.scp_mac_iv));
    console.log("SCP version:", this.scpVersion);

    if (this.scpVersion === 3) {
      // SCP Version 3: AES-CBC with separate MAC
      
      // Add PKCS#7 padding: 0x80 followed by zeros
      let paddedData = new Uint8Array(data.length + 1);
      paddedData.set(data);
      paddedData[data.length] = 0x80;
      
      // Pad to block size
      const blockSize = 16;
      if (paddedData.length % blockSize !== 0) {
        const totalLength = Math.ceil(paddedData.length / blockSize) * blockSize;
        const finalPadded = new Uint8Array(totalLength);
        finalPadded.set(paddedData);
        paddedData = finalPadded;
      }

      console.log("SCP wrap - padded len:", paddedData.length);
      // Encrypt with AES-CBC (no padding)
      let encryptedArray = this.aesCbcEncryptNoPadding(this.scp_enc_key, this.scp_enc_iv, paddedData);
      // Update encryption IV to last block of ciphertext
      this.scp_enc_iv = encryptedArray.slice(-16);
      console.log("SCP wrap - enc ciphertext len:", encryptedArray.length, "new enc_iv:", this.bytesToHex(this.scp_enc_iv));
      
      // Calculate MAC with AES-CBC (no padding)
      const macArray = this.aesCbcEncryptNoPadding(this.scp_mac_key, this.scp_mac_iv, encryptedArray);
      // Update MAC IV to last block
      this.scp_mac_iv = macArray.slice(-16);
      console.log("SCP wrap - mac tail:", this.bytesToHex(this.scp_mac_iv));
      
      // Append last 14 bytes of MAC
      const result = new Uint8Array(encryptedArray.length + SCP_MAC_LENGTH);
      result.set(encryptedArray);
      result.set(this.scp_mac_iv.slice(-SCP_MAC_LENGTH), encryptedArray.length);
      
      console.log("SCP wrap - final wrapped len:", result.length);
      return result;
      
    } else {
      // SCP Version 2: Simple AES-CBC
      let paddedData = new Uint8Array(data.length + 1);
      paddedData.set(data);
      paddedData[data.length] = 0x80;
      
      const blockSize = 16;
      if (paddedData.length % blockSize !== 0) {
        const totalLength = Math.ceil(paddedData.length / blockSize) * blockSize;
        const finalPadded = new Uint8Array(totalLength);
        finalPadded.set(paddedData);
        paddedData = finalPadded;
      }

      const encryptedArray = this.aesCbcEncryptNoPadding(this.scp_enc_key, this.scp_enc_iv, paddedData);
      this.scp_enc_iv = encryptedArray.slice(-16);
      
      return encryptedArray;
    }
  }

  /**
   * Unwrap SCP encrypted data (exact match to Python scpUnwrap)
   */
  async unwrap(data: Uint8Array): Promise<Uint8Array> {
    if (!this.secure || !data || data.length === 0 || data.length === 2 || !this.scp_enc_key || !this.scp_mac_key) {
      return data;
    }

    if (this.scpv3) {
      throw new Error("SCP MODE_SIV not implemented");
    }

    const PADDING_CHAR = 0x80;

    if (this.scpVersion === 3) {
      const encrypted = data.slice(0, -SCP_MAC_LENGTH);
      const mac = data.slice(-SCP_MAC_LENGTH);
      console.log("SCP unwrap - enc len:", encrypted.length, "mac len:", mac.length);
      console.log("SCP unwrap - enc_iv:", this.bytesToHex(this.scp_enc_iv), "mac_iv:", this.bytesToHex(this.scp_mac_iv));
      
      // MAC check (no padding)
      const macArray = this.aesCbcEncryptNoPadding(this.scp_mac_key, this.scp_mac_iv, encrypted);
      this.scp_mac_iv = macArray.slice(-16);
      const expected = this.scp_mac_iv.slice(-SCP_MAC_LENGTH);
      console.log("SCP unwrap - mac expected:", this.bytesToHex(expected), "received:", this.bytesToHex(mac));
      for (let i = 0; i < SCP_MAC_LENGTH; i++) {
        if (expected[i] !== mac[i]) {
          console.error(`MAC mismatch at byte ${i}: expected ${expected[i].toString(16)}, got ${mac[i].toString(16)}`);
          throw new Error('Invalid SCP MAC');
        }
      }
      
      // Decrypt with current enc_iv, then update IV to last cipher block
      const nextIv = encrypted.slice(-16);
      console.log("SCP unwrap - next enc_iv:", this.bytesToHex(nextIv));
      const decryptedArray = this.aesCbcDecryptNoPadding(this.scp_enc_key, this.scp_enc_iv, encrypted);
      this.scp_enc_iv = nextIv;
      console.log("SCP unwrap - set enc_iv to next", this.bytesToHex(this.scp_enc_iv));
      
      // Remove padding
      let L = decryptedArray.length - 1;
      while (L >= 0 && decryptedArray[L] !== PADDING_CHAR) {
        L--;
      }
      if (L < 0) {
        throw new Error("Invalid SCP ENC padding");
      }
      
      return decryptedArray.slice(0, L);
      
    } else {
      // SCP Version 2
      
      // Save next IV before decrypting
      const nextIv = data.slice(-16);
      
      const decryptedArray = this.aesCbcDecryptNoPadding(this.scp_enc_key, this.scp_enc_iv, data);
      
      // Update IV for next operation
      this.scp_enc_iv = nextIv;
      
      // Remove padding
      let L = decryptedArray.length - 1;
      while (L >= 0 && decryptedArray[L] !== PADDING_CHAR) {
        L--;
      }
      if (L < 0) {
        throw new Error("Invalid SCP ENC padding");
      }
      
      return decryptedArray.slice(0, L);
    }
  }

  isSecure(): boolean {
    return this.secure;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}