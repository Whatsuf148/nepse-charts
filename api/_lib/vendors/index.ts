import { mockVendor } from './mock.js';
import { templateVendor } from './template.js';
import type { Vendor } from './types.js';

/** Picks the vendor from the VENDOR env var (default: mock). */
export function getVendor(env: Record<string, string | undefined> = process.env): Vendor {
  switch (env.VENDOR ?? 'mock') {
    case 'mock':
      return mockVendor;
    case 'template':
      return templateVendor(env);
    default:
      throw new Error(`Unknown VENDOR "${env.VENDOR}"`);
  }
}
