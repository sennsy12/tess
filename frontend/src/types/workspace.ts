export interface SavedViewRecord<TState = any> {
  id: string;
  name: string;
  scope: string;
  state: TState;
  isDefault?: boolean;
  isShared?: boolean;
  createdAt: string;
  updatedAt: string;
  owner: {
    id?: number;
    username: string;
    role: string;
  };
  source: 'local' | 'shared';
  remoteId?: number;
}

export interface SaveViewOptions {
  isDefault?: boolean;
  isShared?: boolean;
}
