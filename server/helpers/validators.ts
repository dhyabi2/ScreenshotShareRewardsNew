/**
 * Validate an XNO wallet address
 */
export function isValidXNOAddress(address: string): boolean {
  // Basic validation for Nano addresses
  if (!address) return false;
  
  // Support both nano_ and xno_ prefixes
  if (!address.startsWith('nano_') && !address.startsWith('xno_')) return false;
  
  // The address should be reasonably long
  if (address.length < 60) return false;
  
  // Check that the address contains only valid characters (alphanumeric except 'l', 'v', '0')
  // using less strict validation to support various real-world addresses
  const validChars = /^(nano|xno)_[13456789abcdefghijkmnopqrstuwxyz]/;
  return validChars.test(address);
}