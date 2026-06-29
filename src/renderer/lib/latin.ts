// Оставляет только латинские буквы + пробел, дефис, апостроф.
// Возвращает строко-подобный объект с флагом changed.
export interface SanitizeResult {
  value: string;
  changed: boolean;
  toString(): string;
  valueOf(): string;
}

const DISALLOWED = /[^a-zA-Z \-']/g;

export function sanitizeLatin(input: string): SanitizeResult {
  const value = input.replace(DISALLOWED, '');
  const changed = value !== input;
  return {
    value,
    changed,
    toString: () => value,
    valueOf: () => value,
  };
}
