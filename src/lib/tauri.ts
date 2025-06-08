// Re-export Tauri APIs with proper types
import { invoke } from '@tauri-apps/api/tauri';
import { listen, Event, UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/api/dialog';

// Export types
export interface InvokeArgs {
  [key: string]: unknown;
}

// Re-export functions
export { invoke, listen };
export type { Event, UnlistenFn };

// Type-safe invoke wrapper
export async function invokeTyped<T>(cmd: string, args?: InvokeArgs): Promise<T> {
  return invoke<T>(cmd, args);
}

// Dialog function
export async function openDialog(options: { directory?: boolean; multiple?: boolean; title?: string } = {}): Promise<string | string[] | null> {
  return open(options);
} 