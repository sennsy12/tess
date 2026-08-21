import { ForbiddenError } from '../../middleware/errorHandler.js';
import { assertKundeOwnership } from '../assertOwnership.js';

describe('assertKundeOwnership', () => {
  it('allows admin without kundenr check', () => {
    expect(() =>
      assertKundeOwnership({ role: 'admin', username: 'admin' } as any, 'K000001'),
    ).not.toThrow();
  });

  it('allows kunde accessing own customer number', () => {
    expect(() =>
      assertKundeOwnership({ role: 'kunde', kundenr: 'K000001' } as any, 'K000001'),
    ).not.toThrow();
  });

  it('throws when kunde accesses another customer number', () => {
    expect(() =>
      assertKundeOwnership({ role: 'kunde', kundenr: 'K000001' } as any, 'K000002'),
    ).toThrow(ForbiddenError);
  });
});
