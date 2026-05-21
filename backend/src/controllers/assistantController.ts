import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { getAssistantConfig } from '../assistant/config.js';
import { runAssistantChat } from '../assistant/chatService.js';
import type { AssistantStatusResponse } from '../assistant/types.js';

export const assistantController = {
  status: (_req: AuthRequest, res: Response) => {
    const { enabled } = getAssistantConfig();
    const body: AssistantStatusResponse = { enabled };
    res.json(body);
  },

  chat: async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const result = await runAssistantChat({
      userId: user.id,
      role: user.role,
      body: req.body,
    });
    res.json(result);
  },
};
