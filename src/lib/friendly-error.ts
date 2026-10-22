export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Turn browser and wallet errors into a sentence a person can act on. */
export function friendlyError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const text = raw.trim();
  if (/auth cancelled|notallowederror|the operation either timed out or was not allowed|operation was aborted/i.test(text)) {
    return 'Passkey sign-in was cancelled. You can try again.';
  }
  if (/requested device not found|notfounderror|devices? not found|could not start video source/i.test(text)) {
    return 'No camera was found on this device. Type the code instead.';
  }
  if (/permission denied|notallowederror/i.test(text) && /camera|video|media/i.test(text)) {
    return 'Camera access is off. Allow it for this site, or type the code instead.';
  }
  if (/wallet address unavailable/i.test(text)) {
    return 'This person cannot receive a tip until a wallet is linked.';
  }
  if (text && text.length <= 180 && !/\/api\/|stack|typeerror|0x[a-f0-9]{16,}/i.test(text)) return text;
  return fallback;
}
