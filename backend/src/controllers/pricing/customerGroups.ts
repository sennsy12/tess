import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { customerGroupModel } from '../../models/pricingModel.js';
import { auditService } from '../../services/auditService.js';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler.js';
import { buildListResponse } from '../../lib/listResponse.js';
import { pricingCustomerSearchSchema } from '../../middleware/validation.js';
import { z } from 'zod';
import { CreateCustomerGroupInput } from '../../types/pricing.js';
import { getAuditUser } from './shared.js';

/**
 * Pricing Controller - customer groups handlers
 */
export const customerGroupsHandlers = {
  // ============================================
  // CUSTOMER GROUPS
  // ============================================

  /**
   * GET /api/pricing/groups
   * Get all customer groups
   */
  getGroups: async (req: AuthRequest, res: Response) => {
    const groups = await customerGroupModel.findAll();
    res.json(groups);
  },

  /**
   * POST /api/pricing/groups
   * Create a new customer group
   */
  createGroup: async (req: AuthRequest, res: Response) => {
    const data: CreateCustomerGroupInput = req.body;

    if (!data.name) {
      throw new ValidationError('Name is required');
    }

    const group = await customerGroupModel.create(data);

    await auditService.log({
      user: getAuditUser(req), action: 'CREATE', entityType: 'customer_group',
      entityId: group.id, entityName: group.name, ipAddress: req.ip,
    });

    res.status(201).json(group);
  },

  /**
   * PUT /api/pricing/groups/:id
   * Update a customer group
   */
  updateGroup: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const data: Partial<CreateCustomerGroupInput> = req.body;

    const oldGroup = await customerGroupModel.findById(id);
    if (!oldGroup) {
      throw new NotFoundError('Group not found');
    }

    const group = await customerGroupModel.update(id, data);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    await auditService.log({
      user: getAuditUser(req), action: 'UPDATE', entityType: 'customer_group',
      entityId: id, entityName: group.name,
      oldData: oldGroup as any, newData: group as any, ipAddress: req.ip,
    });

    res.json(group);
  },

  /**
   * DELETE /api/pricing/groups/:id
   * Delete a customer group
   */
  deleteGroup: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);

    const oldGroup = await customerGroupModel.findById(id);
    const deleted = await customerGroupModel.delete(id);

    if (!deleted) {
      throw new NotFoundError('Group not found');
    }

    await auditService.log({
      user: getAuditUser(req), action: 'DELETE', entityType: 'customer_group',
      entityId: id, entityName: oldGroup?.name, oldData: oldGroup as any, ipAddress: req.ip,
    });

    res.json({ message: 'Group deleted successfully' });
  },

  /**
   * PUT /api/pricing/groups/:id/customers/:kundenr
   * Assign a customer to a group
   */
  assignCustomerToGroup: async (req: AuthRequest, res: Response) => {
    const groupId = parseInt(req.params.id);
    const { kundenr } = req.params;

    // Verify group exists
    const group = await customerGroupModel.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const updated = await customerGroupModel.assignCustomer(kundenr, groupId);
    if (!updated) {
      throw new NotFoundError('Customer not found');
    }

    res.json({ message: 'Customer assigned to group successfully' });
  },

  /**
   * DELETE /api/pricing/groups/customers/:kundenr
   * Remove a customer from their group (set to null)
   */
  removeCustomerFromGroup: async (req: AuthRequest, res: Response) => {
    const { kundenr } = req.params;
    const updated = await customerGroupModel.assignCustomer(kundenr, null);

    if (!updated) {
      throw new NotFoundError('Customer not found');
    }

    res.json({ message: 'Customer removed from group successfully' });
  },

  /**
   * GET /api/pricing/customers
   * Get all customers with their group info (lightweight, for dropdowns)
   */
  getCustomersWithGroups: async (req: AuthRequest, res: Response) => {
    const customers = await customerGroupModel.getCustomersWithGroups();
    res.json(customers);
  },

  /**
   * GET /api/pricing/customers/search
   * Search customers with server-side pagination, search, and group filtering
   * Query params: search, group, page, limit
   */
  searchCustomers: async (req: AuthRequest, res: Response) => {
    const { page, limit, sortBy, sortDir, search, group } = req.query as unknown as z.infer<
      typeof pricingCustomerSearchSchema
    >;

    const result = await customerGroupModel.searchCustomersWithGroups({
      search: search ?? '',
      groupId: group,
      page,
      limit,
      sortBy,
      sortDir,
    });

    res.json(buildListResponse(result.data, { page, limit, total: result.total }));
  },
};
