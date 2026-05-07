import React, { useState, useMemo } from 'react';
import AdminLayout from '../components/layout/AdminLayout';

/* ═══════════════════════════════════════════════
   MOCK DATA  — reemplazar con llamadas a la API
═══════════════════════════════════════════════ */
const MOCK_USERS = [
  { _id: 'u1', username: 'ana.torres',    email: 'ana@scidist.io',    createdAt: '2026-01-15T10:00:00Z' },
  { _id: 'u2', username: 'luis.ramos',    email: 'luis@scidist.io',   createdAt: '2026-02-20T08:30:00Z' },
  { _id: 'u3', username: 'maria.lopez',   email: 'maria@scidist.io',  createdAt: '2026-03-05T14:00:00Z' },
  { _id: 'u4', username: 'carlos.mendez', email: 'carlos@scidist.io', createdAt: '2026-04-10T09:15:00Z' },
  { _id: 'u5', username: 'sofia.herrera', email: 'sofia@scidist.io',  createdAt: '2026-05-01T11:45:00Z' },
  { _id: 'u6', username: 'jorge.vargas',  email: 'jorge@scidist.io',  createdAt: '2026-05-03T16:00:00Z' },
];

const MOCK_NODES = [
  { node_id: 'NODE-WIN-01', address: '192.168.1.10:50051', last_seen: new Date(Date.now() - 12000).toISOString() },
  { node_id: 'NODE-WIN-02', address: '192.168.1.11:50051', last_seen: new Date(Date.now() - 45000).toISOString() },
  { node_id: 'NODE-WIN-03', address: '192.168.1.12:50051', last_seen: new Date(Date.now() - 300000).toISOString() },
  { node_id: 'NODE-WIN-04', address: '192.168.1.13:50051', last_seen: new Date(Date.now() - 8000).toISOString() },
];

const MOCK_NODE_HEALTH = [
  { node_id: 'NODE-WIN-01', status: 'up',   last_heartbeat: new Date(Date.now() - 12000).toISOString() },
  { node_id: 'NODE-WIN-02', status: 'up',   last_heartbeat: new Date(Date.now() - 45000).toISOString() },
  { node_id: 'NODE-WIN-03', status: 'down', last_heartbeat: new Date(Date.now() - 300000).toISOString() },
  { node_id: 'NODE-WIN-04', status: 'up',   last_heartbeat: new Date(Date.now() - 8000).toISOString() },
];

const MOCK_REPLICATION = [
  { _id: 'r1', file_hash: 'abc123ef', source_node: 'NODE-WIN-01', target_node: 'NODE-WIN-02', task_type: 'REPLICATE', status: 'done',        retry_count: 0, createdAt: '2026-05-06T08:00:00Z' },
  { _id: 'r2', file_hash: 'def456ab', source_node: 'NODE-WIN-02', target_node: 'NODE-WIN-03', task_type: 'REPLICATE', status: 'pending',     retry_count: 1, createdAt: '2026-05-06T09:15:00Z' },
  { _id: 'r3', file_hash: 'ghi789cd', source_node: 'SYSTEM',      target_node: 'NODE-WIN-01', task_type: 'DELETE',    status: 'in_progress', retry_count: 0, createdAt: '2026-05-06T10:30:00Z' },
  { _id: 'r4', file_hash: 'jkl012ef', source_node: 'NODE-WIN-03', target_node: 'NODE-WIN-04', task_type: 'REPLICATE', status: 'failed',      retry_count: 3, createdAt: '2026-05-06T11:00:00Z' },
  { _id: 'r5', file_hash: 'mno345gh', source_node: 'NODE-WIN-01', target_node: 'NODE-WIN-04', task_type: 'REPLICATE', status: 'done',        retry_count: 0, createdAt: '2026-05-06T11:45:00Z' },
  { _id: 'r6', file_hash: 'pqr678ij', source_node: 'SYSTEM',      target_node: 'NODE-WIN-02', task_type: 'DELETE',    status: 'pending',     retry_count: 0, createdAt: '2026-05-06T12:00:00Z' },
];

const MOCK_STORAGE_MAPS = [
  { _id: 's1', file_hash: 'abc123ef', node_id: 'NODE-WIN-01', is_primary: true,  version: 3, status: 'synced' },
  { _id: 's2', file_hash: 'abc123ef', node_id: 'NODE-WIN-02', is_primary: false, version: 3, status: 'synced' },
  { _id: 's3', file_hash: 'def456ab', node_id: 'NODE-WIN-02', is_primary: true,  version: 1, status: 'synced' },
  { _id: 's4', file_hash: 'ghi789cd', node_id: 'NODE-WIN-03', is_primary: true,  version: 2, status: 'error'  },
  { _id: 's5', file_hash: 'jkl012ef', node_id: 'NODE-WIN-01', is_primary: false, version: 1, status: 'synced' },
  { _id: 's6', file_hash: 'mno345gh', node_id: 'NODE-WIN-04', is_primary: true,  version: 1, status: 'synced' },
];

const MOCK_ARTICLES = [
  { _id: 'a1', title: 'Arquitectura P2P Distribuida',  file_hash: 'abc123ef', owner_id: 'u1', status: 'available', createdAt: '2026-05-04T10:00:00Z' },
  { _id: 'a2', title: 'Modelo de Entrenamiento ML',    file_hash: 'def456ab', owner_id: 'u2', status: 'available', createdAt: '2026-05-03T08:30:00Z' },
  { _id: 'a3', title: 'Gateway Backend Config',         file_hash: 'ghi789cd', owner_id: 'u1', status: 'deleted',   createdAt: '2026-05-02T14:00:00Z' },
  { _id: 'a4', title: 'Apuntes Protocolos de Red',      file_hash: 'jkl012ef', owner_id: 'u3', status: 'available', createdAt: '2026-05-01T09:15:00Z' },
  { _id: 'a5', title: 'Diagrama de Base de Datos',      file_hash: 'mno345gh', owner_id: 'u4', status: 'uploading', createdAt: '2026-05-01T16:00:00Z' },
];

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function hashShort(hash) {
  return hash ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : '—';
}

/* ═══════════════════════════════════════════════
   COMPONENTES COMPARTIDOS
═══════════════════════════════════════════════ */

/* ── Status Badge ── */
const STATUS_META = {
  done:        { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', label: 'Completado'   },
  pending:     { bg: 'rgba(234,179,8,0.15)',   color: '#eab308', label: 'Pendiente'    },
  in_progress: { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', label: 'En proceso'   },
  failed:      { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', label: 'Fallido'      },
  available:   { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', label: 'Disponible'   },
  uploading:   { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', label: 'Subiendo'     },
  deleted:     { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af', label: 'Eliminado'    },
  synced:      { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', label: 'Sincronizado' },
  error:       { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', label: 'Error'        },
  up:          { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', label: 'Online'       },
  down:        { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', label: 'Offline'      },
};

function StatusBadge({ status }) {
  const s = STATUS_META[status] || { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af', label: status };
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      fontFamily: "'DM Mono', monospace",
      fontSize: '0.65rem',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      padding: '0.22rem 0.6rem',
      borderRadius: '2px',
      border: `1px solid ${s.color}40`,
    }}>
      {s.label}
    </span>
  );
}

/* ── Section Header ── */
function SectionHeader({ title, accent, sub }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h1 style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 'clamp(2.2rem, 4vw, 3.5rem)',
        lineHeight: 0.9,
        color: 'var(--adm-paper)',
        margin: 0,
      }}>
        {title} <span style={{ color: 'var(--accent)' }}>{accent}</span>
      </h1>
      <p style={{ color: 'var(--adm-muted)', margin: '0.5rem 0 0', fontSize: '0.8rem' }}>{sub}</p>
    </div>
  );
}

/* ── Admin Table ── */
function AdminTable({ cols, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--adm-border)' }}>
            {cols.map((c) => (
              <th key={c} style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'var(--adm-muted)',
                padding: '0.75rem 1rem',
                textAlign: 'left',
                fontWeight: 400,
                whiteSpace: 'nowrap',
              }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: '1px solid var(--adm-border)', cursor: 'default' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--adm-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MODAL — CREAR / EDITAR USUARIO
═══════════════════════════════════════════════ */
function UserModal({ user, onClose, onSave }) {
  const isNew = !user;
  const [form, setForm] = useState(
    user
      ? { username: user.username, email: user.email, password: '' }
      : { username: '', email: '', password: '' }
  );

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const FIELDS = [
    ['username', 'Usuario', 'text'],
    ['email', 'Email', 'email'],
    ['password', isNew ? 'Contraseña' : 'Nueva contraseña (vacío = sin cambio)', 'password'],
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--adm-surface)',
          border: '1px solid var(--adm-border)',
          width: '100%', maxWidth: 480,
          padding: '2.5rem', position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', color: 'var(--adm-paper)', marginBottom: '0.25rem' }}>
          {isNew ? 'Nuevo' : 'Editar'} <span style={{ color: 'var(--accent)' }}>Usuario</span>
        </div>
        <p style={{ color: 'var(--adm-muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
          {isNew ? 'Crear un nuevo acceso al sistema' : `Modificando cuenta de ${user.username}`}
        </p>

        {FIELDS.map(([key, label, type]) => (
          <div key={key} style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'var(--adm-muted)',
              marginBottom: '0.4rem',
            }}>
              {label}
            </label>
            <input
              type={type}
              value={form[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              style={{
                width: '100%',
                background: 'var(--adm-bg)',
                border: '1px solid var(--adm-border)',
                color: 'var(--adm-paper)',
                padding: '0.65rem 1rem',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>
        ))}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
          <button
            onClick={() => onSave(form)}
            style={{
              flex: 1, background: 'var(--accent)', border: 'none',
              color: '#fff', fontFamily: "'DM Mono', monospace",
              fontSize: '0.75rem', textTransform: 'uppercase',
              letterSpacing: '0.1em', padding: '0.75rem', cursor: 'pointer',
            }}
          >
            {isNew ? 'Crear' : 'Guardar'}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: 'transparent',
              border: '1px solid var(--adm-border)', color: 'var(--adm-muted)',
              fontFamily: "'DM Mono', monospace", fontSize: '0.75rem',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              padding: '0.75rem', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   VISTAS
═══════════════════════════════════════════════ */

/* ── Overview ── */
function ViewOverview({ stats }) {
  const SUMMARY_CARDS = [
    {
      title: 'Estado de Nodos',
      icon: 'bi-hdd-network-fill',
      color: '#22c55e',
      content: `${MOCK_NODE_HEALTH.filter((n) => n.status === 'up').length} online · ${MOCK_NODE_HEALTH.filter((n) => n.status === 'down').length} offline`,
    },
    {
      title: 'Tareas de Replicación',
      icon: 'bi-arrow-repeat',
      color: '#eab308',
      content: `${MOCK_REPLICATION.filter((t) => t.status === 'pending').length} pendientes · ${MOCK_REPLICATION.filter((t) => t.status === 'failed').length} con error`,
    },
    {
      title: 'Almacenamiento',
      icon: 'bi-database-fill',
      color: 'var(--gold)',
      content: `${MOCK_STORAGE_MAPS.filter((m) => m.status === 'synced').length} sincronizados · ${MOCK_STORAGE_MAPS.filter((m) => m.status === 'error').length} con error`,
    },
  ];

  return (
    <>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(2.5rem, 5vw, 4rem)',
          lineHeight: 0.9,
          color: 'var(--adm-paper)',
          margin: 0,
        }}>
          Panel <span style={{ color: 'var(--accent)' }}>Administrador</span>
        </h1>
        <p style={{ color: 'var(--adm-muted)', margin: '0.5rem 0 0', fontSize: '0.8rem' }}>
          Vista general del sistema Scidist-Archive
        </p>
      </div>

      {/* Stats row */}
      <div className="adm-stats-row" style={{ marginBottom: '2.5rem' }}>
        {stats.map((s) => (
          <div key={s.label} className="adm-stat-card">
            <span className="adm-stat-num" style={{ color: s.color }}>{s.value}</span>
            <span className="adm-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Resumen rápido */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
        {SUMMARY_CARDS.map((card) => (
          <div key={card.title} style={{
            background: 'var(--adm-surface)',
            border: '1px solid var(--adm-border)',
            padding: '1.5rem',
            display: 'flex', alignItems: 'center', gap: '1.25rem',
          }}>
            <div style={{
              width: 48, height: 48,
              background: `${card.color}20`,
              border: `1px solid ${card.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <i className={`bi ${card.icon}`} style={{ fontSize: '1.3rem', color: card.color }}></i>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--adm-paper)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                {card.title}
              </div>
              <div style={{ color: 'var(--adm-muted)', fontSize: '0.75rem' }}>{card.content}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Usuarios ── */
function ViewUsers({ users, setUsers }) {
  const [modal, setModal] = useState(null); // null | 'new' | user object

  const handleSave = (form) => {
    if (modal === 'new') {
      setUsers((prev) => [
        ...prev,
        { _id: `u${Date.now()}`, ...form, createdAt: new Date().toISOString() },
      ]);
    } else {
      setUsers((prev) => prev.map((u) => (u._id === modal._id ? { ...u, ...form } : u)));
    }
    setModal(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.'))
      setUsers((prev) => prev.filter((u) => u._id !== id));
  };

  return (
    <>
      {modal && (
        <UserModal
          user={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-end', marginBottom: '2rem',
        flexWrap: 'wrap', gap: '1rem',
      }}>
        <SectionHeader
          title="Gestión de"
          accent="Usuarios"
          sub={`${users.length} cuentas registradas en el sistema`}
        />
        <button
          onClick={() => setModal('new')}
          style={{
            background: 'var(--accent)', border: 'none', color: '#fff',
            fontFamily: "'DM Mono', monospace", fontSize: '0.75rem',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            padding: '0.65rem 1.5rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          <i className="bi bi-person-plus-fill"></i> Nuevo Usuario
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {users.map((user) => {
          const initials = user.username.split('.').map((p) => p[0]?.toUpperCase()).join('') || '??';
          const hue = user._id.charCodeAt(1) * 37 % 360;

          return (
            <div
              key={user._id}
              style={{
                background: 'var(--adm-surface)',
                border: '1px solid var(--adm-border)',
                padding: '1.5rem',
                transition: 'border-color 0.2s, transform 0.2s',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--gold)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--adm-border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                background: `hsl(${hue}, 60%, 50%)`,
              }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', marginTop: '0.5rem' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: `hsl(${hue}, 60%, 20%)`,
                  border: `2px solid hsl(${hue}, 60%, 40%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem',
                  color: `hsl(${hue}, 80%, 70%)`, flexShrink: 0,
                }}>
                  {initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, color: 'var(--adm-paper)', fontSize: '0.9rem',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {user.username}
                  </div>
                  <div style={{
                    color: 'var(--adm-muted)', fontSize: '0.75rem',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {user.email}
                  </div>
                </div>
              </div>

              <div style={{
                borderTop: '1px solid var(--adm-border)', paddingTop: '1rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--adm-muted)' }}>
                  <i className="bi bi-calendar3 me-1"></i>{formatDate(user.createdAt)}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setModal(user)}
                    title="Editar"
                    style={{
                      background: 'transparent', border: '1px solid var(--adm-border)',
                      color: 'var(--gold)', padding: '0.35rem 0.6rem',
                      cursor: 'pointer', transition: '0.2s', fontSize: '0.8rem',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--adm-border)')}
                  >
                    <i className="bi bi-pencil-fill"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(user._id)}
                    title="Eliminar"
                    style={{
                      background: 'transparent', border: '1px solid var(--adm-border)',
                      color: '#ef4444', padding: '0.35rem 0.6rem',
                      cursor: 'pointer', transition: '0.2s', fontSize: '0.8rem',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--adm-border)')}
                  >
                    <i className="bi bi-trash-fill"></i>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Salud de Nodos ── */
function ViewNodeHealth({ nodes }) {
  return (
    <>
      <SectionHeader
        title="Salud de"
        accent="Nodos"
        sub={`${nodes.filter((n) => n.status === 'up').length} de ${nodes.length} nodos online`}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
        {nodes.map((node) => {
          const isUp = node.status === 'up';
          return (
            <div key={node.node_id} style={{
              background: 'var(--adm-surface)',
              border: `1px solid ${isUp ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              padding: '1.5rem', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px',
                background: isUp ? '#22c55e' : '#ef4444',
              }} />
              <div style={{ paddingLeft: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', color: 'var(--adm-paper)', fontWeight: 600 }}>
                    <i className={`bi bi-hdd-network${isUp ? '-fill' : ''} me-2`} style={{ color: isUp ? '#22c55e' : '#ef4444' }}></i>
                    {node.node_id}
                  </span>
                  <StatusBadge status={node.status} />
                </div>
                <div style={{ color: 'var(--adm-muted)', fontSize: '0.75rem' }}>
                  <i className="bi bi-clock me-1 opacity-50"></i>
                  Último latido: {timeAgo(node.last_heartbeat)}
                </div>
                <div style={{
                  marginTop: '1rem', padding: '0.5rem 0.75rem',
                  background: 'var(--adm-bg)',
                  fontFamily: "'DM Mono', monospace", fontSize: '0.65rem',
                  color: 'var(--adm-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: isUp ? '#22c55e' : '#ef4444',
                    boxShadow: isUp ? '0 0 6px #22c55e' : 'none',
                    animation: isUp ? 'pulse 2s infinite' : 'none',
                    display: 'inline-block',
                  }} />
                  {isUp ? 'Conectado y respondiendo' : 'Sin respuesta'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Nodos Activos ── */
function ViewActiveNodes({ nodes }) {
  return (
    <>
      <SectionHeader
        title="Nodos"
        accent="Activos"
        sub="Directorio de nodos registrados en el sistema"
      />
      <AdminTable
        cols={['Node ID', 'Dirección', 'Último visto']}
        rows={nodes.map((n) => [
          <code style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>{n.node_id}</code>,
          <code style={{ color: 'var(--adm-paper)', fontSize: '0.8rem' }}>{n.address}</code>,
          <span style={{ color: 'var(--adm-muted)', fontSize: '0.75rem' }}>{timeAgo(n.last_seen)}</span>,
        ])}
      />
    </>
  );
}

/* ── Tareas de Replicación ── */
function ViewReplication({ tasks }) {
  const TYPE_COLOR = { REPLICATE: '#3b82f6', DELETE: '#ef4444' };
  return (
    <>
      <SectionHeader
        title="Tareas de"
        accent="Replicación"
        sub={`${tasks.filter((t) => t.status === 'pending').length} pendientes · ${tasks.filter((t) => t.status === 'failed').length} fallidas`}
      />
      <AdminTable
        cols={['Hash', 'Tipo', 'Origen', 'Destino', 'Estado', 'Reintentos', 'Fecha']}
        rows={tasks.map((t) => [
          <code style={{ color: 'var(--gold)', fontSize: '0.75rem' }}>{hashShort(t.file_hash)}</code>,
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: TYPE_COLOR[t.task_type] || '#9ca3af', textTransform: 'uppercase' }}>
            {t.task_type}
          </span>,
          <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>{t.source_node}</span>,
          <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>{t.target_node}</span>,
          <StatusBadge status={t.status} />,
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: t.retry_count > 0 ? '#eab308' : 'var(--adm-muted)' }}>
            {t.retry_count}
          </span>,
          <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)' }}>{formatDate(t.createdAt)}</span>,
        ])}
      />
    </>
  );
}

/* ── Mapas de Almacenamiento ── */
function ViewStorageMaps({ maps }) {
  return (
    <>
      <SectionHeader
        title="Mapas de"
        accent="Almacenamiento"
        sub={`${maps.length} registros · ${maps.filter((m) => m.is_primary).length} primarios`}
      />
      <AdminTable
        cols={['Hash', 'Nodo', 'Primario', 'Versión', 'Estado']}
        rows={maps.map((m) => [
          <code style={{ color: 'var(--gold)', fontSize: '0.75rem' }}>{hashShort(m.file_hash)}</code>,
          <code style={{ fontSize: '0.75rem', color: 'var(--adm-paper)' }}>{m.node_id}</code>,
          m.is_primary
            ? <span style={{ color: '#22c55e', fontSize: '0.75rem' }}><i className="bi bi-star-fill me-1"></i>Sí</span>
            : <span style={{ color: 'var(--adm-muted)', fontSize: '0.75rem' }}>No</span>,
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', color: 'var(--adm-paper)' }}>v{m.version}</span>,
          <StatusBadge status={m.status} />,
        ])}
      />
    </>
  );
}

/* ── Artículos ── */
function ViewArticles({ articles }) {
  return (
    <>
      <SectionHeader
        title="Artículos del"
        accent="Sistema"
        sub={`${articles.length} artículos indexados`}
      />
      <AdminTable
        cols={['Título', 'Hash', 'Estado', 'Registrado']}
        rows={articles.map((a) => [
          <span style={{ color: 'var(--adm-paper)', fontSize: '0.85rem', fontWeight: 500 }}>{a.title || '—'}</span>,
          <code style={{ color: 'var(--gold)', fontSize: '0.75rem' }}>{hashShort(a.file_hash)}</code>,
          <StatusBadge status={a.status} />,
          <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)' }}>{formatDate(a.createdAt)}</span>,
        ])}
      />
    </>
  );
}

/* ── Gráficas (placeholder) ── */
function ViewCharts() {
  const PLACEHOLDERS = [
    { icon: 'bi-bar-chart-line-fill', label: 'Archivos por categoría',  color: '#3b82f6' },
    { icon: 'bi-pie-chart-fill',      label: 'Distribución por nodo',   color: '#c9a84c' },
    { icon: 'bi-graph-up-arrow',      label: 'Crecimiento mensual',     color: '#22c55e' },
    { icon: 'bi-activity',            label: 'Latencia de replicación', color: '#e63946' },
  ];

  return (
    <>
      <SectionHeader
        title="Panel de"
        accent="Gráficas"
        sub="Visualizaciones · Próximamente disponibles"
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {PLACEHOLDERS.map((p) => (
          <div key={p.label} style={{
            background: 'var(--adm-surface)',
            border: '1px dashed var(--adm-border)',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
          }}>
            <i className={`bi ${p.icon}`} style={{ fontSize: '2.5rem', color: p.color, opacity: 0.5 }}></i>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '0.75rem',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--adm-muted)',
            }}>
              {p.label}
            </div>
            <span style={{
              background: 'rgba(201,168,76,0.1)',
              border: '1px solid rgba(201,168,76,0.3)',
              color: 'var(--gold)',
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.65rem', padding: '0.2rem 0.75rem', letterSpacing: '0.1em',
            }}>
              PRÓXIMAMENTE
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════
   ROOT — AdminDashboard
═══════════════════════════════════════════════ */
export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('overview');
  const [users, setUsers] = useState(MOCK_USERS);

  /* Badges para el sidebar */
  const sectionBadges = useMemo(() => ({
    users:        users.length,
    articles:     MOCK_ARTICLES.length,
    active_nodes: MOCK_NODES.length,
    node_health:  MOCK_NODE_HEALTH.filter((n) => n.status === 'down').length,
    storage_maps: MOCK_STORAGE_MAPS.length,
    replication:  MOCK_REPLICATION.filter((t) => t.status === 'pending').length,
  }), [users]);

  /* Stats para la barra superior */
  const stats = useMemo(() => [
    { label: 'Usuarios',          value: users.length,                                                                            color: 'var(--adm-paper)' },
    { label: 'Archivos',          value: MOCK_ARTICLES.length,                                                                    color: 'var(--gold)'      },
    { label: 'Nodos',             value: `${MOCK_NODE_HEALTH.filter((n) => n.status === 'up').length}/${MOCK_NODE_HEALTH.length}`, color: '#22c55e'          },
    { label: 'Tareas Pendientes', value: MOCK_REPLICATION.filter((t) => t.status === 'pending').length,                           color: '#eab308'          },
  ], [users]);

  /* Router de vistas */
  const renderSection = () => {
    switch (activeSection) {
      case 'overview':     return <ViewOverview stats={stats} />;
      case 'users':        return <ViewUsers users={users} setUsers={setUsers} />;
      case 'node_health':  return <ViewNodeHealth nodes={MOCK_NODE_HEALTH} />;
      case 'active_nodes': return <ViewActiveNodes nodes={MOCK_NODES} />;
      case 'replication':  return <ViewReplication tasks={MOCK_REPLICATION} />;
      case 'storage_maps': return <ViewStorageMaps maps={MOCK_STORAGE_MAPS} />;
      case 'articles':     return <ViewArticles articles={MOCK_ARTICLES} />;
      case 'charts':       return <ViewCharts />;
      default:             return <ViewOverview stats={stats} />;
    }
  };

  return (
    <AdminLayout
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      sectionBadges={sectionBadges}
      stats={stats}
    >
      {renderSection()}
    </AdminLayout>
  );
}