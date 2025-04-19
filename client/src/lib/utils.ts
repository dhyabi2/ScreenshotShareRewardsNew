import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as XNO with 6 decimal places precision
 */
export function formatXNO(amount: number): string {
  return amount.toFixed(6)
}

/**
 * Truncate an address for display purposes
 */
export function truncateAddress(address: string, startChars = 9, endChars = 5): string {
  if (!address) return ''
  if (address.length <= startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}
