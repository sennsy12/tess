import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { reportsApi } from '../lib/api';

interface SavedReport {
  id: number;
  name: string;
  config: any;
  created_at: string;
}

interface SavedReportsListProps {
  onLoad: (config: any) => void;
  currentConfig: any;
}

export function SavedReportsList({ onLoad, currentConfig }: SavedReportsListProps) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [newReportName, setNewReportName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const response = await reportsApi.getAll();
      setReports(response.data.data);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newReportName.trim()) return;

    setIsSaving(true);
    try {
      await reportsApi.save(newReportName, currentConfig);
      setNewReportName('');
      setShowSaveInput(false);
      await loadReports();
    } catch (error) {
      console.error('Failed to save report:', error);
      toast.error('Kunne ikke lagre rapport');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await reportsApi.delete(id);
      await loadReports();
    } catch (error) {
      console.error('Failed to delete report:', error);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">📑 Lagrede Rapporter</h3>
        <button
          onClick={() => setShowSaveInput(!showSaveInput)}
          className="btn-secondary text-sm"
        >
          {showSaveInput ? 'Avbryt' : '💾 Lagre nåværende'}
        </button>
      </div>

      {showSaveInput && (
        <div className="mb-4 p-4 bg-dark-800/50 rounded-lg border border-dark-700 animate-in fade-in slide-in-from-top-2">
          <label className="label">Navn på rapport</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newReportName}
              onChange={(e) => setNewReportName(e.target.value)}
              placeholder="F.eks. Q1 Salg Region Nord"
              className="input flex-1"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button
              onClick={handleSave}
              disabled={isSaving || !newReportName.trim()}
              className="btn-primary whitespace-nowrap"
            >
              {isSaving ? 'Lagrer...' : 'Lagre'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4 text-dark-400">Laster rapporter...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-8 text-dark-400 bg-dark-800/30 rounded-lg border border-dashed border-dark-700">
          <p>Ingen lagrede rapporter ennå.</p>
          <p className="text-xs mt-1">Konfigurer filtrene og trykk "Lagre nåværende" for å lagre.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {reports.map((report) => (
            <div
              key={report.id}
              className="group flex items-center justify-between p-3 bg-dark-800/50 hover:bg-dark-700 rounded-lg border border-transparent hover:border-primary-500/30 transition-all cursor-pointer"
              onClick={() => onLoad(report.config)}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-dark-200 group-hover:text-white transition-colors">
                  {report.name}
                </div>
                <div className="text-xs text-dark-500 flex gap-2 mt-0.5">
                  <span>📅 {new Date(report.created_at).toLocaleDateString()}</span>
                  <span className="text-dark-600">•</span>
                  <span className="capitalize">{report.config.statType}</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(report.id);
                }}
                className="p-2 text-dark-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                title="Slett rapport"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
