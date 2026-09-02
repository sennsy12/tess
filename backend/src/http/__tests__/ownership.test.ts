/**
 * Unit tests for kunde ownership helpers.
 */
import { ForbiddenError, ValidationError } from '../../middleware/errorHandler';
import { assertOwnsOrder, resolveOrderKundenr } from '../ownership';

describe('resolveOrderKundenr', () => {
  it('kunde always acts as themselves', () => {
    expect(
      resolveOrderKundenr({ role: 'kunde', kundenr: 'K1' }, undefined),
    ).toBe('K1');
  });

  it('kunde with mismatched body kundenr is forbidden', () => {
    expect(() =>
      resolveOrderKundenr({ role: 'kunde', kundenr: 'K1' }, 'K2'),
    ).toThrow(ForbiddenError);
  });

  it('kunde without kundenr fails validation', () => {
    expect(() => resolveOrderKundenr({ role: 'kunde' }, undefined)).toThrow(
      ValidationError,
    );
  });

  it('admin must supply kundenr explicitly', () => {
    expect(resolveOrderKundenr({ role: 'admin' }, 'K9')).toBe('K9');
    expect(() => resolveOrderKundenr({ role: 'admin' }, undefined)).toThrow(
      ValidationError,
    );
  });
});

describe('assertOwnsOrder', () => {
  it('passes for admins regardless', () => {
    expect(() =>
      assertOwnsOrder({ role: 'admin' }, 'K1'),
    ).not.toThrow();
  });

  it('throws when kunde touches another order', () => {
    expect(() =>
      assertOwnsOrder({ role: 'kunde', kundenr: 'K1' }, 'K2'),
    ).toThrow(ForbiddenError);
  });
});
