jest.mock('../../models/customerModel.js', () => ({
  customerModel: {
    findProfileByNumber: jest.fn(),
  },
}));

import { customerProfileService } from '../customerProfileService.js';
import { customerModel } from '../../models/customerModel.js';
import { ForbiddenError, NotFoundError } from '../../middleware/errorHandler.js';

const mockFindProfile = customerModel.findProfileByNumber as jest.Mock;

const sampleDbRow = {
  kundenr: 'K001',
  kundenavn: 'Equinor ASA',
  customer_group_id: 2,
  customer_group_name: 'VIP',
  customer_group_description: 'Premium tier',
  portal_username: 'K001',
  account_created_at: '2024-01-15T00:00:00.000Z',
  primary_firma: 'TESS Norge AS',
  primary_lager: 'Oslo',
  contact_refs_json: ['Ola Nordmann', 'Kari Hansen'],
  order_count: 42,
  total_revenue: 1250000,
  active_orders: 3,
  first_order_date: '2023-06-01',
  last_order_date: '2025-04-10',
};

describe('customerProfileService', () => {
  afterEach(() => jest.resetAllMocks());

  describe('getByKundenr', () => {
    it('maps DB row to API profile shape', async () => {
      mockFindProfile.mockResolvedValueOnce(sampleDbRow);

      const profile = await customerProfileService.getByKundenr('K001');

      expect(mockFindProfile).toHaveBeenCalledWith('K001');
      expect(profile.kundenr).toBe('K001');
      expect(profile.kundenavn).toBe('Equinor ASA');
      expect(profile.customer_group_name).toBe('VIP');
      expect(profile.contact_refs).toEqual(['Ola Nordmann', 'Kari Hansen']);
      expect(profile.stats.order_count).toBe(42);
      expect(profile.stats.active_orders).toBe(3);
    });

    it('throws NotFoundError when customer does not exist', async () => {
      mockFindProfile.mockResolvedValueOnce(null);

      await expect(customerProfileService.getByKundenr('MISSING')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('filters non-string entries from contact_refs_json', async () => {
      mockFindProfile.mockResolvedValueOnce({
        ...sampleDbRow,
        contact_refs_json: ['Valid', 42, null, 'Also valid'],
      });

      const profile = await customerProfileService.getByKundenr('K001');
      expect(profile.contact_refs).toEqual(['Valid', 'Also valid']);
    });

    it('defaults stats when aggregates are null', async () => {
      mockFindProfile.mockResolvedValueOnce({
        ...sampleDbRow,
        contact_refs_json: null,
        order_count: null,
        total_revenue: null,
        active_orders: null,
        first_order_date: null,
        last_order_date: null,
      });

      const profile = await customerProfileService.getByKundenr('K001');
      expect(profile.contact_refs).toEqual([]);
      expect(profile.stats).toEqual({
        order_count: 0,
        total_revenue: 0,
        active_orders: 0,
        first_order_date: null,
        last_order_date: null,
      });
    });
  });

  describe('getForAuthenticatedUser', () => {
    it('returns profile for kunde with linked kundenr', async () => {
      mockFindProfile.mockResolvedValueOnce(sampleDbRow);

      const profile = await customerProfileService.getForAuthenticatedUser({
        id: 1,
        username: 'K001',
        role: 'kunde',
        kundenr: 'K001',
      });

      expect(profile.kundenr).toBe('K001');
      expect(mockFindProfile).toHaveBeenCalledWith('K001');
    });

    it('throws ForbiddenError when user has no kundenr', async () => {
      await expect(
        customerProfileService.getForAuthenticatedUser({
          id: 1,
          username: 'k1',
          role: 'kunde',
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      expect(mockFindProfile).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when user is undefined', async () => {
      await expect(customerProfileService.getForAuthenticatedUser(undefined)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it('uses JWT kundenr only — never accepts override from caller', async () => {
      mockFindProfile.mockResolvedValueOnce({ ...sampleDbRow, kundenr: 'K001' });

      await customerProfileService.getForAuthenticatedUser({
        id: 1,
        username: 'K001',
        role: 'kunde',
        kundenr: 'K001',
      });

      expect(mockFindProfile).toHaveBeenCalledWith('K001');
      expect(mockFindProfile).not.toHaveBeenCalledWith(expect.not.stringMatching('K001'));
    });
  });
});
