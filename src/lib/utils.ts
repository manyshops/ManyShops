import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Class merge helper expected by MagicUI / shadcn components. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
