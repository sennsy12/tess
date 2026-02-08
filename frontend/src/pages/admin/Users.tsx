import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Layout } from '../../components/Layout';
import { usersApi } from '../../lib/api';
import type { UserPublic, CreateUserPayload, UpdateUserPayload } from '../../lib/api';

type ModalMode = 'create' | 'edit' | null;
const PAGE_SIZE = 20;

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'kunde', label: 'Kunde' },
  { value: 'analyse', label: 'Analyse' },
] as const;

const roleBadge = (role: string) => {
  const styles: Record<string, string> = {
    admin: 'bg-red-500/15 text-red-400 border-red-500/30',
    kunde: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    analyse: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  };
  return styles[role] ?? 'bg-dark-700 text-dark-300 border-dark-600';
};

export function AdminUsers() {
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingUser, setEditingUser] = useState<UserPublic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserPublic | null>(null);

  // Form fields
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'kunde' | 'analyse'>('kunde');
  const [formKundenr, setFormKundenr] = useState('');

  // ── Queries ────────────────────────────────────────────────
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin', 'users', page],
    queryFn: () => usersApi.getAll({ page, limit: PAGE_SIZE }).then(res => res.data),
    placeholderData: (prev) => prev,
  });

  const users = usersData?.data ?? [];
  const pagination = usersData?.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 };

  // ── Mutations ──────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateUserPayload) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Bruker opprettet');
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Kunne ikke opprette bruker');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserPayload }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Bruker oppdatert');
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Kunne ikke oppdatere bruker');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      // If we deleted the last item on this page, go back one page
      if (users.length === 1 && page > 1) setPage(p => p - 1);
      toast.success('Bruker slettet');
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Kunne ikke slette bruker');
    },
  });

  // ── Helpers ────────────────────────────────────────────────
  const openCreate = () => {
    setFormUsername('');
    setFormPassword('');
    setFormRole('kunde');
    setFormKundenr('');
    setEditingUser(null);
    setModalMode('create');
  };

  const openEdit = (user: UserPublic) => {
    setFormUsername(user.username);
    setFormPassword('');
    setFormRole(user.role as 'admin' | 'kunde' | 'analyse');
    setFormKundenr(user.kundenr ?? '');
    setEditingUser(user);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingUser(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (modalMode === 'create') {
      createMutation.mutate({
        username: formUsername,
        password: formPassword,
        role: formRole,
        kundenr: formRole === 'kunde' ? formKundenr : undefined,
      });
    } else if (modalMode === 'edit' && editingUser) {
      const payload: UpdateUserPayload = {};
      if (formUsername !== editingUser.username) payload.username = formUsername;
      if (formPassword) payload.password = formPassword;
      if (formRole !== editingUser.role) payload.role = formRole;
      if (formRole === 'kunde') {
        if (formKundenr !== (editingUser.kundenr ?? '')) payload.kundenr = formKundenr || null;
      } else {
        // Clear kundenr if switching away from kunde role
        if (editingUser.kundenr) payload.kundenr = null;
      }
      updateMutation.mutate({ id: editingUser.id, data: payload });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Render ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout title="Brukere">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Brukere">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-dark-400">
              {pagination.total} bruker{pagination.total !== 1 ? 'e' : ''} totalt
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary">
            + Ny bruker
          </button>
        </div>

        {/* Users table */}
        <div className="card p-0 lg:p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-dark-800/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-dark-300 uppercase tracking-wider">ID</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-dark-300 uppercase tracking-wider">Brukernavn</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-dark-300 uppercase tracking-wider">Rolle</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-dark-300 uppercase tracking-wider">Kundenr</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-dark-300 uppercase tracking-wider">Opprettet</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-dark-300 uppercase tracking-wider">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-dark-400">
                      Ingen brukere funnet
                    </td>
                  </tr>
                ) : (
                  users.map((user, idx) => (
                    <tr
                      key={user.id}
                      className={`border-t border-dark-800 transition-colors hover:bg-dark-800/40 ${
                        idx % 2 === 0 ? '' : 'bg-dark-800/20'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-sm text-dark-400">{user.id}</td>
                      <td className="py-3 px-4 text-dark-100 font-medium">{user.username}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${roleBadge(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-sm text-primary-400">
                        {user.kundenr || <span className="text-dark-600">-</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-dark-400">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('nb-NO') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(user)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800 hover:bg-dark-700 text-dark-200 transition-colors"
                          >
                            Rediger
                          </button>
                          <button
                            onClick={() => setDeleteTarget(user)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                          >
                            Slett
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-dark-800 bg-dark-900/30">
              <span className="text-sm text-dark-400">
                Side {pagination.page} av {pagination.totalPages}
                <span className="mx-1.5">&middot;</span>
                {pagination.total} brukere totalt
              </span>

              <div className="flex items-center gap-1">
                {/* First */}
                <button
                  onClick={() => setPage(1)}
                  disabled={pagination.page === 1}
                  className="px-2 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-dark-800 text-dark-300"
                  title="Første side"
                >
                  ««
                </button>
                {/* Prev */}
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                  className="px-2.5 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-dark-800 text-dark-300"
                >
                  «
                </button>

                {/* Page numbers */}
                {(() => {
                  const delta = 2;
                  const range: number[] = [];
                  const start = Math.max(1, pagination.page - delta);
                  const end = Math.min(pagination.totalPages, pagination.page + delta);
                  for (let i = start; i <= end; i++) range.push(i);
                  return (
                    <>
                      {range[0] > 1 && <span className="px-1 text-dark-500 text-sm">...</span>}
                      {range.map(p => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`min-w-[36px] py-1.5 rounded-lg text-sm font-medium transition-all ${
                            p === pagination.page
                              ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                              : 'text-dark-300 hover:bg-dark-800'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                      {range[range.length - 1] < pagination.totalPages && <span className="px-1 text-dark-500 text-sm">...</span>}
                    </>
                  );
                })()}

                {/* Next */}
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-2.5 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-dark-800 text-dark-300"
                >
                  »
                </button>
                {/* Last */}
                <button
                  onClick={() => setPage(pagination.totalPages)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-2 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-dark-800 text-dark-300"
                  title="Siste side"
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ───────────────────────────────── */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-dark-900 border border-dark-700 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-dark-800">
              <h3 className="text-lg font-semibold">
                {modalMode === 'create' ? 'Opprett ny bruker' : 'Rediger bruker'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Brukernavn</label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={e => setFormUsername(e.target.value)}
                  required
                  className="input w-full"
                  placeholder="f.eks. ola.nordmann"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">
                  Passord {modalMode === 'edit' && <span className="text-dark-500">(la stå tomt for å beholde)</span>}
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  required={modalMode === 'create'}
                  minLength={4}
                  className="input w-full"
                  placeholder={modalMode === 'edit' ? '••••••••' : 'Minst 4 tegn'}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Rolle</label>
                <select
                  value={formRole}
                  onChange={e => setFormRole(e.target.value as 'admin' | 'kunde' | 'analyse')}
                  className="input w-full"
                >
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Kundenr - only shown for kunde role */}
              {formRole === 'kunde' && (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Kundenr</label>
                  <input
                    type="text"
                    value={formKundenr}
                    onChange={e => setFormKundenr(e.target.value)}
                    required
                    className="input w-full"
                    placeholder="f.eks. 10001"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Avbryt
                </button>
                <button type="submit" disabled={isSaving} className="btn-primary">
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      Lagrer...
                    </span>
                  ) : modalMode === 'create' ? 'Opprett' : 'Lagre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-dark-900 border border-dark-700 rounded-xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-red-400">Slett bruker</h3>
              <p className="text-dark-300">
                Er du sikker på at du vil slette brukeren{' '}
                <span className="font-medium text-dark-100">{deleteTarget.username}</span>?
                Denne handlingen kan ikke angres.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
                  Avbryt
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Sletter...' : 'Slett'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
