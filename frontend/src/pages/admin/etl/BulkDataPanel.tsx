import { RefObject } from 'react';
import { GridStatSkeleton } from '../../../components/admin';
import { parseBoundedInt } from '../../../lib/formatters';

export interface BulkConfig {
  customers: number;
  orders: number;
  linesPerOrder: number;
}

interface BulkDataPanelProps {
  bulkConfig: BulkConfig;
  onBulkConfigChange: (config: BulkConfig) => void;
  tableCounts: Record<string, number>;
  countsLoading: boolean;
  isLoading: boolean;
  loadingActionId: string | null;
  csvFileRef: RefObject<HTMLInputElement>;
  onGenerate: () => void;
  onInsert: () => void;
  onPipeline: () => void;
  onCsvUpload: () => void;
}

export function BulkDataPanel({
  bulkConfig,
  onBulkConfigChange,
  tableCounts,
  countsLoading,
  isLoading,
  loadingActionId,
  csvFileRef,
  onGenerate,
  onInsert,
  onPipeline,
  onCsvUpload,
}: BulkDataPanelProps) {
  return (
    <div className="space-y-6 stagger-fade-in">
      <div className="card">
        <h3 className="font-semibold mb-4">Nåværende Data</h3>
        {countsLoading && Object.keys(tableCounts).length === 0 ? (
          <GridStatSkeleton count={6} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-fade-in">
            {Object.entries(tableCounts).map(([table, count]) => (
              <div
                key={table}
                className="bg-dark-800/50 p-3 rounded-lg transition-all duration-200 hover:bg-dark-800/80"
              >
                <span className="text-dark-400 text-sm capitalize">{table}</span>
                <p className="text-xl font-bold">{count.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">Generer Bulk Data</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label htmlFor="bulk-customers" className="label">
              Antall Kunder
            </label>
            <input
              id="bulk-customers"
              type="number"
              min={1}
              max={100000}
              value={bulkConfig.customers}
              onChange={(e) =>
                onBulkConfigChange({
                  ...bulkConfig,
                  customers: parseBoundedInt(e.target.value, 1, 100000),
                })
              }
              className="input"
            />
          </div>
          <div>
            <label htmlFor="bulk-orders" className="label">
              Antall Ordrer
            </label>
            <input
              id="bulk-orders"
              type="number"
              min={1}
              max={1000000}
              value={bulkConfig.orders}
              onChange={(e) =>
                onBulkConfigChange({
                  ...bulkConfig,
                  orders: parseBoundedInt(e.target.value, 1, 1000000),
                })
              }
              className="input"
            />
          </div>
          <div>
            <label htmlFor="bulk-lines" className="label">
              Linjer per Ordre
            </label>
            <input
              id="bulk-lines"
              type="number"
              min={1}
              max={100}
              value={bulkConfig.linesPerOrder}
              onChange={(e) =>
                onBulkConfigChange({
                  ...bulkConfig,
                  linesPerOrder: parseBoundedInt(e.target.value, 1, 100),
                })
              }
              className="input"
            />
          </div>
        </div>
        <p className="text-sm text-dark-400 mb-4">
          Estimert: ~{(bulkConfig.orders * bulkConfig.linesPerOrder).toLocaleString()} ordrelinjer
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onGenerate} disabled={isLoading} className="btn-secondary">
            Generer Data
          </button>
          <button type="button" onClick={onInsert} disabled={isLoading} className="btn-secondary">
            Sett Inn Data
          </button>
          <button type="button" onClick={onPipeline} disabled={isLoading} className="btn-primary">
            Full Bulk Pipeline
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">Last opp CSV</h3>
        <div className="space-y-4">
          <div className="flex-1">
            <label htmlFor="bulk-csv-file" className="label">
              Velg CSV Fil
            </label>
            <input id="bulk-csv-file" type="file" accept=".csv" ref={csvFileRef} className="input" />
          </div>

          <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-800/30">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">Instruksjoner:</h4>
            <ul className="text-xs text-dark-300 space-y-1 list-disc pl-4">
              <li>Filen må være en CSV med header-rad.</li>
              <li>Systemet vil automatisk gjenkjenne tabellen basert på kolonnenavnene.</li>
              <li>Eksisterende rader (basert på primærnøkkel) vil bli hoppet over.</li>
              <li>Støttede tabeller: Ordre, Ordrelinje, Kunde, Vare, Firma, Lager.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={onCsvUpload}
            disabled={isLoading}
            className="btn-primary w-full md:w-auto"
          >
            {loadingActionId === 'Last opp CSV' ? 'Laster opp...' : 'Last Opp'}
          </button>
        </div>
      </div>
    </div>
  );
}
