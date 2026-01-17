import { CustomerWithGroup, CustomerGroup } from '../types';

interface Props {
  customersWithGroups: CustomerWithGroup[];
  groups: CustomerGroup[];
  handleAssignCustomer: (kundenr: string, groupId: number | null) => void;
}

export function CustomersTab({ customersWithGroups, groups, handleAssignCustomer }: Props) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Tildel kunder til grupper</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-700">
              <th className="text-left py-3 px-4 text-dark-300 font-medium">Kundenr</th>
              <th className="text-left py-3 px-4 text-dark-300 font-medium">Kundenavn</th>
              <th className="text-left py-3 px-4 text-dark-300 font-medium">Gruppe</th>
            </tr>
          </thead>
          <tbody>
            {customersWithGroups.slice(0, 100).map((customer) => (
              <tr key={customer.kundenr} className="border-b border-dark-800 hover:bg-dark-800/50">
                <td className="py-3 px-4 font-mono text-sm">{customer.kundenr}</td>
                <td className="py-3 px-4">{customer.kundenavn}</td>
                <td className="py-3 px-4">
                  <select
                    value={customer.customer_group_id || ''}
                    onChange={(e) =>
                      handleAssignCustomer(customer.kundenr, e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="input"
                  >
                    <option value="">Standard</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {customersWithGroups.length > 100 && (
        <div className="text-center py-4 text-dark-400">
          Viser første 100 av {customersWithGroups.length} kunder
        </div>
      )}
    </div>
  );
}
