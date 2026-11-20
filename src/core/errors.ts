/** Malformed inputs/scenario/arguments. The CLI maps this to exit code 2 (contract B). */
export class FormatError extends Error {
  override name = 'FormatError';
}

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
