import { allowDestructiveEtl } from '../../../lib/appConfig';
import { etlApi } from '../../../lib/api';

export interface EtlActionDefinition {
  id: string;
  label: string;
  api: () => Promise<unknown>;
  destructive: boolean;
}

export const ETL_ACTIONS: EtlActionDefinition[] = [
  { id: 'createDB', label: 'Opprett DB', api: etlApi.createDB, destructive: true },
  { id: 'truncateDB', label: 'Tøm DB', api: etlApi.truncateDB, destructive: true },
  { id: 'generateTestData', label: 'Generer Test', api: etlApi.generateTestData, destructive: false },
  { id: 'insertTestData', label: 'Sett Inn Test', api: etlApi.insertTestData, destructive: false },
  { id: 'runFullTestPipeline', label: 'Full Pipeline', api: etlApi.runFullTestPipeline, destructive: true },
];

const ACTION_ICONS: Record<string, string> = {
  createDB: '🏗️',
  truncateDB: '🗑️',
  generateTestData: '🎲',
  insertTestData: '📥',
  runFullTestPipeline: '🚀',
};

interface EtlActionsPanelProps {
  isLoading: boolean;
  loadingActionId: string | null;
  onAction: (action: EtlActionDefinition) => void;
}

export function EtlActionsPanel({ isLoading, loadingActionId, onAction }: EtlActionsPanelProps) {
  return (
    <>
      {!allowDestructiveEtl && (
        <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3 text-sm text-amber-100">
          Destruktive ETL-handlinger er deaktivert i produksjon.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 stagger-fade-in">
        {ETL_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action)}
            disabled={isLoading || (action.destructive && !allowDestructiveEtl)}
            className={`card-interactive text-center py-6 cursor-pointer ${
              loadingActionId === action.id ? 'opacity-50' : ''
            } ${action.destructive && !allowDestructiveEtl ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span className="text-2xl block mb-2">{ACTION_ICONS[action.id] ?? '⚙️'}</span>
            <span className="text-sm">{action.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
