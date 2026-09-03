import {
  sanitizeHistoryComment,
} from '../orderHistory';

describe('sanitizeHistoryComment', () => {
  it('returns null for missing optional comment', () => {
    expect(sanitizeHistoryComment(undefined)).toBeNull();
    expect(sanitizeHistoryComment(null)).toBeNull();
    expect(sanitizeHistoryComment('   ')).toBeNull();
  });

  it('throws 400 for missing required comment (reject)', () => {
    expect(() => sanitizeHistoryComment(undefined, { required: true })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(() => sanitizeHistoryComment('   ', { required: true })).toThrow(/Begrunnelse/);
  });

  it('strips HTML and collapses whitespace', () => {
    expect(sanitizeHistoryComment('<b>Feil</b>  pris\n\nkontakt')).toBe('Feil pris kontakt');
  });

  it('rejects comments over 500 chars', () => {
    expect(() => sanitizeHistoryComment('x'.repeat(501))).toThrow(/500/);
    expect(sanitizeHistoryComment('x'.repeat(500))).toHaveLength(500);
  });

  it('rejects non-string input', () => {
    expect(() => sanitizeHistoryComment(123 as unknown as string)).toThrow();
  });
});
