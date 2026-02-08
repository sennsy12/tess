import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Layout } from '../../components/Layout';
import { PageHeader, Pagination, FormModal, ConfirmModal } from '../../components/admin';
import { usersApi } from '../../lib/api';
import type { UserPublic, CreateUserPayload, UpdateUserPayload } from '../../lib/api';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

type ModalMode = 'create' | 'edit' | null;
const PAGE_SIZE = 20;

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'kunde', label: 'Kunde' },
  { value: 'analyse', label: 'Analyse' },
] as const;

type RoleValue = (typeof ROLE_OPTIONS)[number]['value'];

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: 'bg-red-500/15 text-red-400 border-red-500/30',
  kunde: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  analyse: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

/** Table row for a single user – extracted to keep the table body clean. */
function UserRow({
  user,
  isEven,
  onEdit,
  onDelete,
}: {
  user: UserPublic;
  isEven: boolean;
  onEdit: (user: UserPublic) => void;
  onDelete: (user: UserPublic) => void;
}) {
  const badgeClass =
    ROLE_BADGE_STYLES[user.role] ?? 'bg-dark-700 text-dark-300 border-dark-600';

  return (
    <tr
      className={`border-t border-dark-800 transition-colors hover:bg-dark-800/40 ${
        isEven ? '' : 'bg-dark-800/20'
      }`}
    >
      <td className="py-3 px-4 font-mono text-sm text-dark-400">{user.id}</td>
      <td className="py-3 px-4 text-dark-100 font-medium">{user.username}</td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badgeClass}`}
        >
          {user.role}
        </span>
      </td>
      <td className="py-3 px-4 font-mono text-sm text-primary-400">
        {user.kundenr || <span className="text-dark-600">-</span>}
      </td>
      <td className="py-3 px-4 text-sm text-dark-400">
        {user.created_at
          ? new Date(user.created_at).toLocaleDateString('nb-NO')
          : '-'}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(user)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800 hover:bg-dark-700 text-dark-200 transition-colors"
          >
            Rediger
          </button>
          <button
            onClick={() => onDelete(user)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
          >
            Slett
          </button>
        </div>
      </td>
    </tr>
  );
}

/** The users data table including the thead & empty state. */
function UserTable({
  users,
  onEdit,
  onDelete,
}: {
  users: UserPublic[];
  onEdit: (user: UserPublic) => void;
  onDelete: (user: UserPublic) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-dark-800/50">
            {['ID', 'Brukernavn', 'Rolle', 'Kundenr', 'Opprettet', 'Handlinger'].map(
              (header, idx) => (
                <th
                  key={header}
                  className={`${
                    idx === 5 ? 'text-right' : 'text-left'
                  } py-3 px-4 text-xs font-semibold text-dark-300 uppercase tracking-wider`}
                >
                  {header}
                </th>
              ),
            )}
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
              <UserRow
                key={user.id}
                user={user}
                isEven={idx % 2 === 0}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Form fields rendered inside the create / edit FormModal. */
function UserFormFields({
  mode,
  username,
  password,
  role,
  kundenr,
  onUsernameChange,
  onPasswordChange,
  onRoleChange,
  onKundenrChange,
}: {
  mode: 'create' | 'edit';
  username: string;
  password: string;
  role: RoleValue;
  kundenr: string;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onRoleChange: (v: RoleValue) => void;
  onKundenrChange: (v: string) => void;
}) {
  return (
    <>
      {/* Username */}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-1">
          Brukernavn
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          required
          className="input w-full"
          placeholder="f.eks. ola.nordmann"
        />
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-1">
          Passord{' '}
          {mode === 'edit' && (
            <span className="text-dark-500">(la stå tomt for å beholde)</span>
          )}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required={mode === 'create'}
          minLength={4}
          className="input w-full"
          placeholder={mode === 'edit' ? '••••••••' : 'Minst 4 tegn'}
        />
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-1">
          Rolle
        </label>
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value as RoleValue)}
          className="input w-full"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Kundenr – only for "kunde" role */}
      {role === 'kunde' && (
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-1">
            Kundenr
          </label>
          <input
            type="text"
            value={kundenr}
            onChange={(e) => onKundenrChange(e.target.value)}
            required
            className="input w-full"
            placeholder="f.eks. 10001"
          />
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Main page component
// ────────────────────────────────────────────────────────────

export function AdminUsers() {
  const queryClient = useQueryClient();

  // ── State ───────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingUser, setEditingUser] = useState<UserPublic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserPublic | null>(null);

  // Form fields
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<RoleValue>('kunde');
  const [formKundenr, setFormKundenr] = useState('');

  // ── Queries ─────────────────────────────────────────────
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin', 'users', page],
    queryFn: () => usersApi.getAll({ page, limit: PAGE_SIZE }).then((res) => res.data),
    placeholderData: (prev) => prev,
  });

  const users = usersData?.data ?? [];
  const pagination = usersData?.pagination ?? {
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  };

  // ── Mutations ───────────────────────────────────────────
  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserPayload) => usersApi.create(data),
    onSuccess: () => {
      invalidateUsers();
      toast.success('Bruker opprettet');
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Kunne ikke opprette bruker');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserPayload }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      invalidateUsers();
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
      invalidateUsers();
      if (users.length === 1 && page > 1) setPage((p) => p - 1);
      toast.success('Bruker slettet');
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Kunne ikke slette bruker');
    },
  });

  // ── Handlers ────────────────────────────────────────────
  const openCreate = useCallback(() => {
    setFormUsername('');
    setFormPassword('');
    setFormRole('kunde');
    setFormKundenr('');
    setEditingUser(null);
    setModalMode('create');
  }, []);

  const openEdit = useCallback((user: UserPublic) => {
    setFormUsername(user.username);
    setFormPassword('');
    setFormRole(user.role as RoleValue);
    setFormKundenr(user.kundenr ?? '');
    setEditingUser(user);
    setModalMode('edit');
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditingUser(null);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
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
        let actionKey: string | undefined;
        if (formPassword) {
          const key = window.prompt('Skriv inn sikkerhetskode for å endre passord:');
          if (!key) return;
          actionKey = key;
        }
        if (formUsername !== editingUser.username) payload.username = formUsername;
        if (formPassword) {
          payload.password = formPassword;
          payload.actionKey = actionKey;
        }
        if (formRole !== editingUser.role) payload.role = formRole;
        if (formRole === 'kunde') {
          if (formKundenr !== (editingUser.kundenr ?? ''))
            payload.kundenr = formKundenr || null;
        } else if (editingUser.kundenr) {
          payload.kundenr = null;
        }
        updateMutation.mutate({ id: editingUser.id, data: payload });
      }
    },
    [
      modalMode,
      formUsername,
      formPassword,
      formRole,
      formKundenr,
      editingUser,
      createMutation,
      updateMutation,
    ],
  );

  const handleDelete = useCallback((user: UserPublic) => {
    setDeleteTarget(user);
  }, []);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Render ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout title="Brukere">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Brukere">
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          count={pagination.total}
          countLabel={`bruker${pagination.total !== 1 ? 'e' : ''}`}
          action={
            <button onClick={openCreate} className="btn-primary">
              + Ny bruker
            </button>
          }
        />

        {/* Users table */}
        <div className="card p-0 lg:p-0 overflow-hidden">
          <UserTable users={users} onEdit={openEdit} onDelete={handleDelete} />

          {/* Pagination */}
          <Pagination
            pagination={pagination}
            onPageChange={setPage}
            variant="full"
            itemLabel="brukere"
            className="px-4 py-3 border-t border-dark-800 bg-dark-900/30"
          />
        </div>
      </div>

      {/* Create / Edit modal */}
      <FormModal
        open={modalMode !== null}
        onClose={closeModal}
        onSubmit={handleSubmit}
        title={modalMode === 'create' ? 'Opprett ny bruker' : 'Rediger bruker'}
        submitLabel={modalMode === 'create' ? 'Opprett' : 'Lagre'}
        loading={isSaving}
      >
        <UserFormFields
          mode={modalMode ?? 'create'}
          username={formUsername}
          password={formPassword}
          role={formRole}
          kundenr={formKundenr}
          onUsernameChange={setFormUsername}
          onPasswordChange={setFormPassword}
          onRoleChange={setFormRole}
          onKundenrChange={setFormKundenr}
        />
      </FormModal>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Slett bruker"
        confirmLabel="Slett"
        loading={deleteMutation.isPending}
      >
        Er du sikker på at du vil slette brukeren{' '}
        <span className="font-medium text-dark-100">{deleteTarget?.username}</span>?
        Denne handlingen kan ikke angres.
      </ConfirmModal>
    </Layout>
  );
}
