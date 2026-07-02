import { generateFolio } from './folio.util';

describe('generateFolio', () => {
  it('matches the CTH-XXXXXX format with unambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateFolio()).toMatch(/^CTH-[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it('does not produce the same folio on every call', () => {
    const folios = new Set(Array.from({ length: 20 }, () => generateFolio()));
    expect(folios.size).toBeGreaterThan(1);
  });
});
