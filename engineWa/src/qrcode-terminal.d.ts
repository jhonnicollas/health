declare module 'qrcode-terminal' {
  export function generate(text: string, opts: { small?: boolean; type?: string }, callback?: (data: string) => void): void;
  export function generate(text: string, callback?: (data: string) => void): void;
}
