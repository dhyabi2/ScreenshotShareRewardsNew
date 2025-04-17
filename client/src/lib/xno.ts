// Helper functions for working with XNO cryptocurrency

/**
 * Format XNO amount with appropriate decimal places
 */
export const formatXNO = (amount: number): string => {
  return amount.toFixed(4) + " XNO";
};

/**
 * Validate a Nano/XNO wallet address
 */
export const isValidXNOAddress = (address: string): boolean => {
  // XNO addresses start with nano_ or xno_ and are 65 characters long
  const regex = /^(nano|xno)_[13][13-9a-km-uw-z]{59}$/;
  return regex.test(address);
};

/**
 * Truncate wallet address for display
 */
export const truncateAddress = (address: string, prefixLength = 5, suffixLength = 5): string => {
  if (!address) return '';
  
  if (address.length <= prefixLength + suffixLength) {
    return address;
  }
  
  const prefix = address.slice(0, prefixLength);
  const suffix = address.slice(-suffixLength);
  
  return `${prefix}...${suffix}`;
};

/**
 * Generate a payment URL for nano/xno transactions
 */
export const generatePaymentUrl = (receiverAddress: string, amount: number, message?: string): string => {
  // Format the amount with proper precision
  const formattedAmount = amount.toString();
  
  let url = `nano:${receiverAddress}?amount=${formattedAmount}`;
  
  if (message) {
    url += `&message=${encodeURIComponent(message)}`;
  }
  
  return url;
};
