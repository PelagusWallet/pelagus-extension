/**
 * Parse app list response from Ledger device
 * The format is structured:
 * - 1 byte: version (0x01)
 * - For each app:
 *   - 1 byte: total size of this app entry (including size byte)
 *   - 4 bytes: flags
 *   - 32 bytes: code_data_hash
 *   - 32 bytes: full_hash
 *   - Pascal string: name (1 byte length + name bytes)
 */

export function parseAppList(data: Uint8Array): string[] {
    const apps: string[] = [];
    
    if (data.length === 0) return apps;
    
    console.log('Raw app list data (first 200 bytes):', bytesToHex(data.slice(0, Math.min(200, data.length))));
    console.log('Full data length:', data.length);
    
    // First byte is version (0x01)
    if (data[0] !== 0x01) {
      console.warn('Unexpected version byte:', data[0]);
    }
    
    let offset = 1;
    
    // Parse each app structure
    while (offset < data.length) {
      // Read size of this app entry
      const entrySize = data[offset];
      
      if (entrySize === 0 || offset + entrySize > data.length) {
        console.log(`Invalid entry size ${entrySize} at offset ${offset}, stopping parse`);
        break;
      }
      
      console.log(`App entry at offset ${offset}, size: ${entrySize}`);
      
      // Expected minimum size: 1 (size) + 4 (flags) + 32 (hash1) + 32 (hash2) + 2 (min name)
      if (entrySize < 71) {
        console.log(`Entry size too small: ${entrySize}, skipping`);
        offset++;
        continue;
      }
      
      // Skip to name: offset + 1 (size byte) + 4 (flags) + 32 (hash1) + 32 (hash2)
      const nameOffset = offset + 1 + 4 + 32 + 32;
      
      if (nameOffset < data.length) {
        const nameLength = data[nameOffset];
        
        if (nameOffset + 1 + nameLength <= data.length && nameLength > 0 && nameLength < 50) {
          const nameBytes = data.slice(nameOffset + 1, nameOffset + 1 + nameLength);
          
          try {
            const name = new TextDecoder().decode(nameBytes);
            
            // Basic validation that it's a printable string
            if (/^[\x20-\x7E]+$/.test(name)) {
              console.log(`Found app: "${name}" (name length: ${nameLength})`);
              apps.push(name);
            }
          } catch (e) {
            console.log(`Failed to decode app name at offset ${nameOffset}`);
          }
        }
      }
      
      // Move to next app entry
      offset += entrySize;
    }
    
    console.log(`Parsed ${apps.length} apps from structured data`);
    return apps;
  }
  
  export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }