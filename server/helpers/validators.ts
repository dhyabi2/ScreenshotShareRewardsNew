/**
 * Input validators for the application
 */

import * as nanocurrency from 'nanocurrency-web';

/**
 * Validate an XNO wallet address using nanocurrency-web library
 */
export function isValidXNOAddress(address: string): boolean {
  if (!address) return false;
  
  try {
    // Use the nanocurrency library's built-in address validator
    // The library doesn't have a checkAddress function, so we use tools.validateAddress
    return nanocurrency.tools.validateAddress(address);
  } catch (error) {
    // If there's an error in the validation process, fall back to regex validation
    return fallbackValidateAddress(address);
  }
}

/**
 * Fallback address validator in case the library fails
 */
function fallbackValidateAddress(address: string): boolean {
  // XNO addresses start with 'nano_' and are 65 characters long
  if (!address.startsWith('nano_') || address.length !== 65) {
    return false;
  }
  
  // After 'nano_', there should be 52 more characters (alphanumeric excluding certain letters)
  const validChars = /^[13456789abcdefghijkmnopqrstuwxyz]+$/;
  const addressPart = address.substring(5);
  
  return validChars.test(addressPart) && addressPart.length === 60;
}