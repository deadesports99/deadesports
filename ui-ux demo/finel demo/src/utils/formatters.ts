export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function generateUTR(): string {
  return `UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
}

export function generateEGAId(): string {
  return `EGA-${Math.floor(1000000 + Math.random() * 9000000)}`;
}
