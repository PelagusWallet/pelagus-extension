// @ts-nocheck
import type Transport from "@ledgerhq/hw-transport";
import type { EIP712Message } from "@ledgerhq/types-live";

/**
 * Fixed version of signEIP712Message that properly handles P1 flags
 * for struct field definitions
 */
export async function signEIP712MessageFixed(
  transport: Transport,
  path: string,
  typedMessage: EIP712Message
): Promise<{ v: number; s: string; r: string }> {
  const { domain, primaryType, message } = typedMessage;
  
  // Ensure EIP712Domain is in types - it's required by Ledger but often not included by dApps
  const types = { ...typedMessage.types };
  if (!types.EIP712Domain) {
    const domainFields: EIP712Field[] = [];
    
    // Build EIP712Domain type based on what's actually in the domain
    if (domain.name !== undefined) domainFields.push({ name: 'name', type: 'string' });
    if (domain.version !== undefined) domainFields.push({ name: 'version', type: 'string' });
    if (domain.chainId !== undefined) domainFields.push({ name: 'chainId', type: 'uint256' });
    if (domain.verifyingContract !== undefined) domainFields.push({ name: 'verifyingContract', type: 'address' });
    if (domain.salt !== undefined) domainFields.push({ name: 'salt', type: 'bytes32' });
    
    types.EIP712Domain = domainFields;
  }
  
  // Helper to encode field types (simplified version)
  function encodeFieldType(typeName: string): Buffer {
    const buffers: Buffer[] = [];
    
    // Determine type descriptor
    let typeDesc = 0;
    let typeSize: number | undefined;
    
    const baseType = typeName.replace(/\[\d*\]/g, '');
    
    if (baseType === 'address') {
      typeDesc = 3; // TYPE_SOL_ADDRESS
    } else if (baseType === 'string') {
      typeDesc = 5; // TYPE_SOL_STRING
    } else if (baseType.startsWith('uint')) {
      typeDesc = 2; // TYPE_SOL_UINT
      if (baseType !== 'uint') {
        typeDesc |= 0x40; // TYPESIZE_MASK
        typeSize = parseInt(baseType.substring(4)) / 8;
      }
    } else if (baseType.startsWith('int')) {
      typeDesc = 1; // TYPE_SOL_INT
      if (baseType !== 'int') {
        typeDesc |= 0x40; // TYPESIZE_MASK
        typeSize = parseInt(baseType.substring(3)) / 8;
      }
    } else if (baseType === 'bool') {
      typeDesc = 4; // TYPE_SOL_BOOL
    } else if (baseType.startsWith('bytes')) {
      if (baseType === 'bytes') {
        typeDesc = 7; // TYPE_SOL_BYTES_DYN
      } else {
        typeDesc = 6 | 0x40; // TYPE_SOL_BYTES_FIX with TYPESIZE_MASK
        typeSize = parseInt(baseType.substring(5));
      }
    } else {
      // Custom type
      typeDesc = 0; // TYPE_CUSTOM
    }
    
    // Add array flag if needed
    if (typeName.includes('[')) {
      typeDesc |= 0x80; // ARRAY_MASK
    }
    
    buffers.push(Buffer.from([typeDesc]));
    
    if (typeSize !== undefined) {
      buffers.push(Buffer.from([typeSize]));
    }
    
    // For custom types, add name
    if (typeDesc === 0 || (typeDesc & 0x0F) === 0) {
      const customName = baseType;
      const nameBytes = Buffer.from(customName, 'utf-8');
      buffers.push(Buffer.from([nameBytes.length]));
      buffers.push(nameBytes);
    }
    
    // Handle arrays (simplified - just dynamic arrays)
    if (typeName.includes('[')) {
      buffers.push(Buffer.from([1])); // 1 array dimension
      buffers.push(Buffer.from([0])); // 0 = dynamic array
    }
    
    return Buffer.concat(buffers);
  }
  
  // Step 1: Send struct definitions
  const typeEntries = Object.entries(types);
  
  for (const [typeName, fields] of typeEntries) {
    // Send struct name
    await transport.send(
      0xE0, // CLA
      0x1A, // INS_EIP712_STRUCT_DEF
      0x00, // P1_COMPLETE
      0x00, // P2_NAME
      Buffer.from(typeName, 'utf-8')
    );
    
    // Send fields with proper P1 flags
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const isLast = i === fields.length - 1;
      
      // Encode field
      const typeBuffer = encodeFieldType(field.type);
      const fieldNameBytes = Buffer.from(field.name, 'utf-8');
      const fieldBuffer = Buffer.concat([
        typeBuffer,
        Buffer.from([fieldNameBytes.length]),
        fieldNameBytes
      ]);
      
      await transport.send(
        0xE0, // CLA
        0x1A, // INS_EIP712_STRUCT_DEF
        isLast ? 0x00 : 0x01, // P1: COMPLETE for last, PARTIAL for others
        0xFF, // P2_FIELD
        fieldBuffer
      );
    }
  }
  
  // Step 2: Send struct implementations
  // Send domain
  await transport.send(
    0xE0, // CLA
    0x1C, // INS_EIP712_STRUCT_IMPL
    0x00, // P1_COMPLETE
    0x00, // P2_ROOT
    Buffer.from("EIP712Domain", 'utf-8')
  );
  
  // Send domain fields
  const domainFields = types.EIP712Domain;
  for (const field of domainFields) {
    const value = domain[field.name];
    let encodedValue: Buffer;
    
    if (field.type === 'string') {
      const strBytes = Buffer.from(value, 'utf-8');
      encodedValue = Buffer.concat([
        Buffer.from([0, strBytes.length]),
        strBytes
      ]);
    } else if (field.type === 'uint256') {
      const bn = BigInt(value);
      encodedValue = Buffer.alloc(34); // 2 bytes length + 32 bytes data
      encodedValue[1] = 32; // length = 32
      let hex = bn.toString(16);
      if (hex.length % 2) hex = '0' + hex;
      const bytes = Buffer.from(hex, 'hex');
      bytes.copy(encodedValue, 34 - bytes.length);
    } else if (field.type === 'address') {
      const addr = value.startsWith('0x') ? value.slice(2) : value;
      const addrBytes = Buffer.from(addr, 'hex');
      encodedValue = Buffer.concat([
        Buffer.from([0, 20]), // length = 20 for address
        addrBytes
      ]);
    } else {
      throw new Error(`Unsupported domain field type: ${field.type}`);
    }
    
    await transport.send(
      0xE0, // CLA
      0x1C, // INS_EIP712_STRUCT_IMPL
      0x00, // P1_COMPLETE
      0xFF, // P2_FIELD
      encodedValue
    );
  }
  
  // Send message
  await transport.send(
    0xE0, // CLA
    0x1C, // INS_EIP712_STRUCT_IMPL
    0x00, // P1_COMPLETE
    0x00, // P2_ROOT
    Buffer.from(primaryType, 'utf-8')
  );
  
  // Send message fields
  const messageFields = types[primaryType];
  for (const field of messageFields) {
    const value = message[field.name];
    let encodedValue: Buffer;
    
    // Similar encoding as domain fields
    if (field.type === 'string') {
      const strBytes = Buffer.from(value, 'utf-8');
      encodedValue = Buffer.concat([
        Buffer.from([0, strBytes.length]),
        strBytes
      ]);
    } else if (field.type.startsWith('uint')) {
      const bn = BigInt(value);
      encodedValue = Buffer.alloc(34);
      encodedValue[1] = 32;
      let hex = bn.toString(16);
      if (hex.length % 2) hex = '0' + hex;
      const bytes = Buffer.from(hex, 'hex');
      bytes.copy(encodedValue, 34 - bytes.length);
    } else if (field.type === 'address') {
      const addr = value.startsWith('0x') ? value.slice(2) : value;
      const addrBytes = Buffer.from(addr, 'hex');
      encodedValue = Buffer.concat([
        Buffer.from([0, 20]),
        addrBytes
      ]);
    } else {
      throw new Error(`Unsupported message field type: ${field.type}`);
    }
    
    await transport.send(
      0xE0, // CLA
      0x1C, // INS_EIP712_STRUCT_IMPL
      0x00, // P1_COMPLETE
      0xFF, // P2_FIELD
      encodedValue
    );
  }
  
  // Step 3: Sign
  const pathComponents = path.split('/').filter(c => c !== 'm');
  const derivationPath = pathComponents.map(component => {
    const num = parseInt(component.replace("'", ''));
    return component.includes("'") ? 0x80000000 | num : num;
  });
  
  const pathBuffer = Buffer.alloc(1 + derivationPath.length * 4);
  pathBuffer[0] = derivationPath.length;
  derivationPath.forEach((segment, i) => {
    pathBuffer.writeUInt32BE(segment >>> 0, 1 + i * 4);
  });
  
  transport.setExchangeTimeout(120000); // 2 minutes for user interaction
  
  const response = await transport.send(
    0xE0, // CLA
    0x0C, // INS_SIGN_EIP712
    0x00, // P1
    0x01, // P2_FULL
    pathBuffer
  );
  
  // Parse signature
  const v = response[0];
  const r = response.slice(1, 33).toString('hex');
  const s = response.slice(33, 65).toString('hex');
  
  return { v, r, s };
}