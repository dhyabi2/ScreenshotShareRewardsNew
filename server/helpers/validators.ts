/**
 * Validate an XNO wallet address
 */
export function isValidXNOAddress(address: string): boolean {
  // XNO addresses start with nano_ or xno_ and are 65 characters long
  const regex = /^(nano|xno)_[13][13-9a-km-uw-z]{59}$/;
  return regex.test(address);
}
