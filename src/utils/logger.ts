export function debug(...args: any[]) {
  console.log('[DEBUG]', ...args);
}

export function error(...args: any[]) {
  console.error('[ERROR]', ...args);
}

export function info(...args: any[]) {
  console.log('[INFO]', ...args);
}

export function progress(step: string, details?: string) {
  console.log(`[PROGRESS] ${step}${details ? `: ${details}` : ''}`);
}
