/**
 * Global bridge registry.
 * Survives HMR via globalThis, allowing server actions to access the bridge.
 */
import type { OpenClawBridge } from "./openclaw-bridge";

const globalForBridge = globalThis as typeof globalThis & {
  __openclawBridge?: OpenClawBridge;
};

export function setBridge(bridge: OpenClawBridge): void {
  globalForBridge.__openclawBridge = bridge;
}

export function getBridge(): OpenClawBridge | undefined {
  return globalForBridge.__openclawBridge;
}
