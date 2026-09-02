/**
 * Unit tests for the COPY line encoder.
 */
import { countCopyLines, encodeCopyLine } from '../encodeCopyLine';

describe('encodeCopyLine', () => {
  it('encodes nulls as \\N and joins with tabs', () => {
    expect(encodeCopyLine([1, null, undefined, 'a'])).toBe('1\t\\N\t\\N\ta\n');
  });

  it('escapes special characters', () => {
    expect(encodeCopyLine(['a\tb', 'c\nd', 'e\\f'])).toBe(
      'a\\tb\tc\\nd\te\\\\f\n',
    );
  });

  it('leaves plain values untouched', () => {
    expect(encodeCopyLine(['abc', 42])).toBe('abc\t42\n');
  });
});

describe('countCopyLines', () => {
  it('counts newlines', () => {
    expect(countCopyLines('a\nb\nc\n')).toBe(3);
    expect(countCopyLines('')).toBe(0);
  });
});
