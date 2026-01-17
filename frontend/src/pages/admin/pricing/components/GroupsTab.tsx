import { CustomerGroup, GroupFormData, INITIAL_GROUP_FORM } from '../types';

interface Props {
  groups: CustomerGroup[];
  showGroupForm: boolean;
  editingGroup: CustomerGroup | null;
  groupForm: GroupFormData;
  setShowGroupForm: (show: boolean) => void;
  setEditingGroup: (group: CustomerGroup | null) => void;
  setGroupForm: (form: GroupFormData) => void;
  handleCreateGroup: (e: React.FormEvent) => void;
  handleUpdateGroup: (e: React.FormEvent) => void;
  handleDeleteGroup: (id: number) => void;
}

export function GroupsTab({
  groups,
  showGroupForm,
  editingGroup,
  groupForm,
  setShowGroupForm,
  setEditingGroup,
  setGroupForm,
  handleCreateGroup,
  handleUpdateGroup,
  handleDeleteGroup,
}: Props) {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Kundegrupper</h3>
        <button
          onClick={() => {
            setShowGroupForm(true);
            setEditingGroup(null);
            setGroupForm(INITIAL_GROUP_FORM);
          }}
          className="btn-primary"
        >
          + Ny Gruppe
        </button>
      </div>

      {/* Group Form */}
      {(showGroupForm || editingGroup) && (
        <form
          onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup}
          className="bg-dark-800 p-4 rounded-lg mb-4 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Navn</label>
              <input
                type="text"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Beskrivelse</label>
              <input
                type="text"
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {editingGroup ? 'Oppdater' : 'Opprett'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowGroupForm(false);
                setEditingGroup(null);
              }}
              className="btn-secondary"
            >
              Avbryt
            </button>
          </div>
        </form>
      )}

      {/* Groups Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-700">
              <th className="text-left py-3 px-4 text-dark-300 font-medium">Navn</th>
              <th className="text-left py-3 px-4 text-dark-300 font-medium">Beskrivelse</th>
              <th className="text-right py-3 px-4 text-dark-300 font-medium">Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                <td className="py-3 px-4 font-medium">{group.name}</td>
                <td className="py-3 px-4 text-dark-400">{group.description || '-'}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => {
                      setEditingGroup(group);
                      setGroupForm({ name: group.name, description: group.description || '' });
                    }}
                    className="text-primary-400 hover:text-primary-300 mr-3"
                  >
                    Rediger
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
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
