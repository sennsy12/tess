import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { suggestionModel } from '../models/suggestionModel.js';

export const suggestionController = {
  search: async (req: AuthRequest, res: Response) => {
    const { q } = req.query;
    
    if (!q || String(q).length < 3) {
      return res.json([]);
    }
    
    const suggestions = await suggestionModel.search(String(q), req.user);
    res.json(suggestions);
  }
};

