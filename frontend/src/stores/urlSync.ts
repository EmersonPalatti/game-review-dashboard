let suppressUrlSync = false;

export function suppressUrlSyncDuring(fn: () => void): void {
  suppressUrlSync = true;
  try {
    fn();
  } finally {
    suppressUrlSync = false;
  }
}

export function isUrlSyncSuppressed(): boolean {
  return suppressUrlSync;
}
