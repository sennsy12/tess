export interface ActionResult {
  action: string;
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  timestamp: Date;
}

export interface Job {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  status: string;
  lastRun?: string;
  lastError?: string;
}
