export {};

declare global {
  interface Window {
    pendo?: {
      track?: (
        event: string,
        properties?: Record<string, string | number | boolean | null | undefined>,
      ) => void;
    };
  }
}
