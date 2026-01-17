import { PriceList, ListFormData, INITIAL_LIST_FORM, Tab } from '../types';

interface Props {
  lists: PriceList[];
  showListForm: boolean;
  editingList: PriceList | null;
  listForm: ListFormData;
  setShowListForm: (show: boolean) => void;
  setEditingList: (list: PriceList | null) => void;
  setListForm: (form: ListFormData) => void;
  handleCreateList: (e: React.FormEvent) => void;
  handleUpdateList: (e: React.FormEvent) => void;
  handleDeleteList: (id: number) => void;
  handleToggleListActive: (list: PriceList) => void;
  loadRules: (listId: number) => void;
  setActiveTab: (tab: Tab) => void;
}

export function ListsTab({
  lists,
  showListForm,
  editingList,
  listForm,
  setShowListForm,
  setEditingList,
  setListForm,
  handleCreateList,
  handleUpdateList,
  handleDeleteList,
  handleToggleListActive,
  loadRules,
  setActiveTab,
}: Props) {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Prislister</h3>
        <button
          onClick={() => {
            setShowListForm(true);
            setEditingList(null);
            setListForm(INITIAL_LIST_FORM);
          }}
          className="btn-primary"
        >
          + Ny Prisliste
        </button>
      </div>

      {/* List Form */}
      {(showListForm || editingList) && (
        <form
          onSubmit={editingList ? handleUpdateList : handleCreateList}
          className="bg-dark-800 p-4 rounded-lg mb-4 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Navn</label>
              <input
                type="text"
                value={listForm.name}
                onChange={(e) => setListForm({ ...listForm, name: e.target.value })}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Beskrivelse</label>
              <input
                type="text"
                value={listForm.description}
                onChange={(e) => setListForm({ ...listForm, description: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Prioritet</label>
              <input
                type="number"
                value={listForm.priority}
                onChange={(e) => setListForm({ ...listForm, priority: parseInt(e.target.value) || 0 })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Gyldig fra</label>
              <input
                type="date"
                value={listForm.valid_from}
                onChange={(e) => setListForm({ ...listForm, valid_from: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Gyldig til</label>
              <input
                type="date"
                value={listForm.valid_to}
                onChange={(e) => setListForm({ ...listForm, valid_to: e.target.value })}
                className="input w-full"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="is_active"
                checked={listForm.is_active}
                onChange={(e) => setListForm({ ...listForm, is_active: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="is_active" className="text-sm text-dark-300">Aktiv</label>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {editingList ? 'Oppdater' : 'Opprett'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowListForm(false);
                setEditingList(null);
              }}
              className="btn-secondary"
            >
              Avbryt
            </button>
          </div>
        </form>
      )}

      {/* Lists Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-700">
              <th className="text-left py-3 px-4 text-dark-300 font-medium">Navn</th>
              <th className="text-left py-3 px-4 text-dark-300 font-medium">Prioritet</th>
              <th className="text-left py-3 px-4 text-dark-300 font-medium">Gyldighet</th>
              <th className="text-left py-3 px-4 text-dark-300 font-medium">Status</th>
              <th className="text-right py-3 px-4 text-dark-300 font-medium">Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {lists.map((list) => (
              <tr key={list.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                <td className="py-3 px-4">
                  <div className="font-medium">{list.name}</div>
                  {list.description && <div className="text-sm text-dark-400">{list.description}</div>}
                </td>
                <td className="py-3 px-4">{list.priority}</td>
                <td className="py-3 px-4 text-sm">
                  {list.valid_from || list.valid_to ? (
                    <>
                      {list.valid_from && new Date(list.valid_from).toLocaleDateString('nb-NO')}
                      {' - '}
                      {list.valid_to && new Date(list.valid_to).toLocaleDateString('nb-NO')}
                    </>
                  ) : (
                    <span className="text-dark-400">Alltid gyldig</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => handleToggleListActive(list)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      list.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-dark-700 text-dark-400'
                    }`}
                  >
                    {list.is_active ? 'Aktiv' : 'Inaktiv'}
                  </button>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => {
                      setActiveTab('rules');
                      loadRules(list.id);
                    }}
                    className="text-primary-400 hover:text-primary-300 mr-3"
                  >
                    Regler
                  </button>
                  <button
                    onClick={() => {
                      setEditingList(list);
                      setListForm({
                        name: list.name,
                        description: list.description || '',
                        valid_from: list.valid_from ? list.valid_from.split('T')[0] : '',
                        valid_to: list.valid_to ? list.valid_to.split('T')[0] : '',
                        priority: list.priority,
                        is_active: list.is_active,
                      });
                    }}
                    className="text-primary-400 hover:text-primary-300 mr-3"
                  >
                    Rediger
                  </button>
                  <button
                    onClick={() => handleDeleteList(list.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Slett
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
