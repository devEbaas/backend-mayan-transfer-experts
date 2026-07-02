const FOLIO_PREFIX = 'CTH';
// Excludes visually ambiguous characters (0/O, 1/I) to keep folios easy to read over phone/WhatsApp.
const FOLIO_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FOLIO_CODE_LENGTH = 6;

export function generateFolio(): string {
  let code = '';
  for (let i = 0; i < FOLIO_CODE_LENGTH; i++) {
    code += FOLIO_ALPHABET[Math.floor(Math.random() * FOLIO_ALPHABET.length)];
  }
  return `${FOLIO_PREFIX}-${code}`;
}
