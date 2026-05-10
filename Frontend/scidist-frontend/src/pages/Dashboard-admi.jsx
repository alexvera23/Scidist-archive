import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import api from '../api/axiosConfig';

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
function timeAgo(isoString) {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function hashShort(hash) {
  return hash ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : '—';
}

function adminHeaders() {
  const stored = localStorage.getItem('user');
  if (!stored) return {};
  return { 'x-user-id': JSON.parse(stored).id };
}

/* ═══════════════════════════════════════════════
   ESTADO INICIAL POR ENTIDAD
═══════════════════════════════════════════════ */
const EMPTY_STATE = { data: [], loading: true, error: null };

/* ═══════════════════════════════════════════════
   COMPONENTES COMPARTIDOS
═══════════════════════════════════════════════ */
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
  healthy:     { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', label: 'Saludable'    },
  unreachable: { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', label: 'Inalcanzable' },
};

function StatusBadge({ status }) {
  const s = STATUS_META[status] || { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af', label: status };
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontFamily: "'DM Mono', monospace", fontSize: '0.65rem',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      padding: '0.22rem 0.6rem', borderRadius: '2px',
      border: `1px solid ${s.color}40`,
    }}>{s.label}</span>
  );
}

function SectionHeader({ title, accent, sub }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h1 style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 'clamp(2.2rem, 4vw, 3.5rem)',
        lineHeight: 0.9, color: 'var(--adm-paper)', margin: 0,
      }}>
        {title} <span style={{ color: 'var(--accent)' }}>{accent}</span>
      </h1>
      <p style={{ color: 'var(--adm-muted)', margin: '0.5rem 0 0', fontSize: '0.8rem' }}>{sub}</p>
    </div>
  );
}

function AdminTable({ cols, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--adm-border)' }}>
            {cols.map((c) => (
              <th key={c} style={{
                fontFamily: "'DM Mono', monospace", fontSize: '0.65rem',
                textTransform: 'uppercase', letterSpacing: '0.15em',
                color: 'var(--adm-muted)', padding: '0.75rem 1rem',
                textAlign: 'left', fontWeight: 400, whiteSpace: 'nowrap',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}
              style={{ borderBottom: '1px solid var(--adm-border)', cursor: 'default' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--adm-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionState({ loading, error, empty, onRetry }) {
  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--adm-muted)' }}>
      <div style={{
        width: 36, height: 36, border: '2px solid var(--adm-border)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem',
      }} />
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Cargando datos...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
  if (error) return (
    <div style={{ textAlign: 'center', padding: '4rem 0' }}>
      <i className="bi bi-exclamation-triangle" style={{ fontSize: '2.5rem', color: 'var(--accent)', opacity: 0.6 }}></i>
      <p style={{ color: 'var(--adm-muted)', fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', margin: '1rem 0 1.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {error}
      </p>
      {onRetry && (
        <button onClick={onRetry} style={{
          background: 'transparent', border: '1px solid var(--adm-border)',
          color: 'var(--adm-muted)', fontFamily: "'DM Mono', monospace",
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em',
          padding: '0.5rem 1.2rem', cursor: 'pointer',
        }}>
          <i className="bi bi-arrow-clockwise me-2"></i>Reintentar
        </button>
      )}
    </div>
  );
  if (empty) return (
    <div style={{ textAlign: 'center', padding: '4rem 0' }}>
      <i className="bi bi-inbox" style={{ fontSize: '2.5rem', color: 'var(--adm-muted)', opacity: 0.3 }}></i>
      <p style={{ color: 'var(--adm-muted)', fontSize: '0.85rem', marginTop: '1rem' }}>Sin registros</p>
    </div>
  );
  return null;
}

/* ─────────────────────────────────────────────────────────────
   SUBCOMPONENTE — DROPDOWN DE CATEGORÍAS (estilo admin oscuro)
   Usado tanto en CREATE (selección) como en EDIT (añadir más)
   
   Props:
   · availableCategories  — catálogo completo [{ id, name, subthemes[] }]
   · selectedTopics       — { [catName]: [subName, ...] }
   · onToggle             — (catName, subName) => void
   · loading              — bool
   · placeholder          — texto cuando no hay selección
───────────────────────────────────────────────────────────── */
function CategoriesDropdown({ availableCategories, selectedTopics, onToggle, loading, placeholder }) {
  const [open, setOpen]   = useState(false);
  const dropdownRef       = useRef(null);

  const totalSelected = Object.values(selectedTopics).reduce((a, v) => a + v.length, 0);

  /* Cerrar al hacer clic fuera */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const S = {
    wrapper: {
      position: 'relative',
    },
    toggle: {
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--adm-bg)', border: `1px solid ${open ? 'var(--gold)' : 'var(--adm-border)'}`,
      color: totalSelected > 0 ? 'var(--adm-paper)' : 'var(--adm-muted)',
      padding: '0.65rem 1rem', cursor: 'pointer', transition: 'border-color 0.2s',
      fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem',
    },
    menu: {
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
      background: 'var(--adm-surface)', border: '1px solid var(--adm-border)',
      maxHeight: 260, overflowY: 'auto',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    },
    categoryTitle: {
      fontFamily: "'DM Mono', monospace", fontSize: '0.65rem',
      textTransform: 'uppercase', letterSpacing: '0.15em',
      color: 'var(--gold)', padding: '0.75rem 1rem 0.4rem',
      borderTop: '1px solid var(--adm-border)',
    },
    subthemesRow: {
      display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.4rem 1rem 0.75rem',
    },
    chip: (checked) => ({
      display: 'flex', alignItems: 'center', gap: '0.35rem',
      background: checked ? 'rgba(230,57,70,0.15)' : 'var(--adm-bg)',
      border: `1px solid ${checked ? 'rgba(230,57,70,0.5)' : 'var(--adm-border)'}`,
      color: checked ? 'var(--accent)' : 'var(--adm-muted)',
      padding: '0.25rem 0.65rem', borderRadius: '2px', cursor: 'pointer',
      fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem',
      transition: 'all 0.15s',
      userSelect: 'none',
    }),
    counter: {
      fontFamily: "'DM Mono', monospace", fontSize: '0.65rem',
      color: 'var(--adm-muted)', padding: '0.5rem 1rem',
      borderTop: '1px solid var(--adm-border)',
    },
  };

  return (
    <div style={S.wrapper} ref={dropdownRef}>
      <button type="button" style={S.toggle} onClick={() => setOpen((p) => !p)}>
        <span>
          {totalSelected === 0
            ? placeholder || 'Seleccionar categorías...'
            : `${totalSelected} subtema${totalSelected !== 1 ? 's' : ''} seleccionado${totalSelected !== 1 ? 's' : ''}`}
        </span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: '0.8rem' }}></i>
      </button>

      {open && (
        <div style={S.menu}>
          {loading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--adm-muted)', fontSize: '0.8rem' }}>
              <div style={{ width: 20, height: 20, border: '2px solid var(--adm-border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.5rem' }} />
              Cargando catálogo...
            </div>
          ) : (
            availableCategories.map((cat) => (
              <div key={cat.id || cat.name}>
                <div style={S.categoryTitle}>{cat.name}</div>
                <div style={S.subthemesRow}>
                  {cat.subthemes.map((sub) => {
                    const checked = selectedTopics[cat.name]?.includes(sub) || false;
                    return (
                      <span
                        key={sub}
                        style={S.chip(checked)}
                        onClick={() => onToggle(cat.name, sub)}
                      >
                        {checked && <i className="bi bi-check2" style={{ fontSize: '0.7rem' }}></i>}
                        {sub}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          <div style={S.counter}>
            {totalSelected} subtema{totalSelected !== 1 ? 's' : ''} seleccionado{totalSelected !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MODAL — CREAR / EDITAR USUARIO
   
   CREATE: form básico + dropdown de selección de categorías
           → usa POST /auth/register (mismo que el form de registro)
   
   EDIT:   form básico + gestión del árbol actual (borrar)
                       + dropdown para añadir categorías nuevas
           → usa PUT /admin/users/:id  +  endpoints de themes
═══════════════════════════════════════════════ */
function UserModal({ user, onClose, onSave, isSaving }) {
  const isNew = !user;

  /* ── Formulario básico ── */
  const [form, setForm] = useState(
    user
      ? { username: user.username, email: user.email, password: '' }
      : { username: '', email: '', password: '' }
  );
  const handleField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  /* ── Catálogo disponible (compartido por ambos modos) ── */
  const [catalog,        setCatalog]        = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  /* ── CREATE: subtemas elegidos ── */
  const [selectedTopics, setSelectedTopics] = useState({});

  /* ── EDIT: árbol actual del usuario ── */
  const [userTree,      setUserTree]      = useState([]);
  const [loadingTree,   setLoadingTree]   = useState(false);

  /* ── EDIT: elementos marcados para borrar ── */
  const [deleteThemeIds,   setDeleteThemeIds]   = useState(new Set());
  const [deleteSubIds,     setDeleteSubIds]     = useState(new Set());

  /* ── EDIT: nuevos subtemas a agregar ── */
  const [newTopics, setNewTopics] = useState({});

  /* ── Cargar catálogo siempre, árbol solo en edit ── */
  useEffect(() => {
    const loadCatalog = async () => {
      setLoadingCatalog(true);
      try {
        const { data } = await api.get('/categories/available', { headers: adminHeaders() });
        setCatalog(data);
      } catch { /* silencioso */ }
      finally { setLoadingCatalog(false); }
    };

    const loadUserTree = async () => {
      setLoadingTree(true);
      try {
        /* Endpoint que devuelve el árbol con IDs de subtemas (ver admin-extra-endpoints.js) */
        const { data } = await api.get(`/admin/users/${user._id}/themes`, { headers: adminHeaders() });
        setUserTree(data);
      } catch { /* silencioso */ }
      finally { setLoadingTree(false); }
    };

    loadCatalog();
    if (!isNew) loadUserTree();
  }, []); // eslint-disable-line

  /* ── Handlers de selección (CREATE) ── */
  const handleToggleNew = (catName, subName) => {
    setSelectedTopics((prev) => {
      const arr = prev[catName] ? [...prev[catName]] : [];
      const idx = arr.indexOf(subName);
      if (idx === -1) arr.push(subName);
      else arr.splice(idx, 1);
      return { ...prev, [catName]: arr };
    });
  };

  /* ── Handlers de selección (EDIT — añadir nuevos) ── */
  const handleToggleAdd = (catName, subName) => {
    setNewTopics((prev) => {
      const arr = prev[catName] ? [...prev[catName]] : [];
      const idx = arr.indexOf(subName);
      if (idx === -1) arr.push(subName);
      else arr.splice(idx, 1);
      return { ...prev, [catName]: arr };
    });
  };

  /* ── Helpers para borrar en EDIT ── */
  const toggleDeleteTheme = (id) =>
    setDeleteThemeIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleDeleteSub = (id) =>
    setDeleteSubIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  /* ── Catálogo filtrado para el dropdown de EDIT
        Muestra solo subtemas que el usuario NO tiene aún ── */
  const existingSubNames = useMemo(() => {
    const names = new Set();
    userTree.forEach((t) => t.subthemes.forEach((s) => names.add(s.name)));
    return names;
  }, [userTree]);

  const catalogForAdd = useMemo(() =>
    catalog.map((cat) => ({
      ...cat,
      subthemes: cat.subthemes.filter((sub) => !existingSubNames.has(sub)),
    })).filter((cat) => cat.subthemes.length > 0),
  [catalog, existingSubNames]);

  /* ── Conteos para feedback visual ── */
  const totalSelectedNew  = Object.values(selectedTopics).reduce((a, v) => a + v.length, 0);
  const totalToAdd        = Object.values(newTopics).reduce((a, v) => a + v.length, 0);
  const totalToDelete     = deleteThemeIds.size + deleteSubIds.size;

  /* ── Submit ── */
  const handleSave = () => {
    if (isNew) {
      onSave({ form, selectedTopics });
    } else {
      onSave({ form, deleteThemeIds, deleteSubIds, newTopics });
    }
  };

  /* ── Estilos compartidos dentro del modal ── */
  const S = {
    overlay: {
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    },
    panel: {
      background: 'var(--adm-surface)', border: '1px solid var(--adm-border)',
      width: '100%', maxWidth: 560,
      maxHeight: '90vh', overflowY: 'auto',
      position: 'relative',
    },
    header: { padding: '2rem 2rem 0' },
    body:   { padding: '1.5rem 2rem 2rem' },
    divider: {
      fontFamily: "'DM Mono', monospace", fontSize: '0.6rem',
      textTransform: 'uppercase', letterSpacing: '0.2em',
      color: 'var(--adm-muted)', margin: '1.75rem 0 1rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
    },
    dividerLine: { flex: 1, height: 1, background: 'var(--adm-border)' },
    fieldLabel: {
      display: 'block', fontFamily: "'DM Mono', monospace",
      fontSize: '0.62rem', textTransform: 'uppercase',
      letterSpacing: '0.15em', color: 'var(--adm-muted)', marginBottom: '0.4rem',
    },
    input: {
      width: '100%', background: 'var(--adm-bg)',
      border: '1px solid var(--adm-border)', color: 'var(--adm-paper)',
      padding: '0.65rem 1rem', fontFamily: "'DM Sans', sans-serif",
      fontSize: '0.875rem', outline: 'none', marginBottom: '1rem',
    },
    /* Chip de "marcado para eliminar" */
    chipDel: (marked) => ({
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      border: `1px solid ${marked ? '#ef4444' : 'var(--adm-border)'}`,
      background: marked ? 'rgba(239,68,68,0.1)' : 'var(--adm-bg)',
      color: marked ? '#ef4444' : 'var(--adm-muted)',
      padding: '0.3rem 0.65rem', borderRadius: '2px', cursor: 'pointer',
      fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem',
      textDecoration: marked ? 'line-through' : 'none',
      transition: 'all 0.15s', userSelect: 'none',
    }),
  };

  return (
    <div style={S.overlay} onClick={!isSaving ? onClose : undefined}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>

        {/* ── Cabecera ── */}
        <div style={S.header}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: 'var(--adm-paper)' }}>
            {isNew ? 'Nuevo' : 'Editar'} <span style={{ color: 'var(--accent)' }}>Usuario</span>
          </div>
          <p style={{ color: 'var(--adm-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
            {isNew
              ? 'Crear cuenta y definir árbol de categorías'
              : `Modificando: ${user.username}`}
          </p>
        </div>

        <div style={S.body}>

          {/* ─── DATOS DE CUENTA ─── */}
          <div style={S.divider}>
            <i className="bi bi-person-fill"></i>
            <span>Datos de cuenta</span>
            <span style={S.dividerLine}></span>
          </div>

          {[
            ['username', 'Nombre de usuario', 'text'],
            ['email',    'Email',             'email'],
            ['password', isNew ? 'Contraseña' : 'Nueva contraseña (vacío = sin cambio)', 'password'],
          ].map(([key, label, type]) => (
            <div key={key}>
              <label style={S.fieldLabel}>{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => handleField(key, e.target.value)}
                disabled={isSaving}
                style={{ ...S.input, opacity: isSaving ? 0.5 : 1 }}
              />
            </div>
          ))}

          {/* ─── CATEGORÍAS (CREATE) ─── */}
          {isNew && (
            <>
              <div style={S.divider}>
                <i className="bi bi-tags-fill"></i>
                <span>Categorías iniciales</span>
                <span style={S.dividerLine}></span>
              </div>

              <label style={S.fieldLabel}>Elige los intereses del usuario</label>
              <CategoriesDropdown
                availableCategories={catalog}
                selectedTopics={selectedTopics}
                onToggle={handleToggleNew}
                loading={loadingCatalog}
                placeholder="Seleccionar categorías del catálogo..."
              />
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--adm-muted)', marginTop: '0.5rem' }}>
                {totalSelectedNew} subtema{totalSelectedNew !== 1 ? 's' : ''} seleccionado{totalSelectedNew !== 1 ? 's' : ''}.
                Se creará "General / Otros" automáticamente.
              </p>
            </>
          )}

          {/* ─── ÁRBOL ACTUAL (EDIT) ─── */}
          {!isNew && (
            <>
              <div style={S.divider}>
                <i className="bi bi-diagram-2-fill"></i>
                <span>Árbol de categorías</span>
                {totalToDelete > 0 && (
                  <span style={{
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                    color: '#ef4444', fontFamily: "'DM Mono', monospace",
                    fontSize: '0.6rem', padding: '0.1rem 0.5rem', borderRadius: '2px',
                  }}>
                    {totalToDelete} a eliminar
                  </span>
                )}
                <span style={S.dividerLine}></span>
              </div>

              {loadingTree ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--adm-muted)', fontSize: '0.8rem' }}>
                  <div style={{ width: 18, height: 18, border: '2px solid var(--adm-border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block', marginRight: '0.5rem' }} />
                  Cargando árbol...
                </div>
              ) : userTree.length === 0 ? (
                <p style={{ color: 'var(--adm-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
                  Sin categorías registradas
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {userTree.map((theme) => {
                    const isProtected = theme.name.toLowerCase() === 'general';
                    const themeMarked = deleteThemeIds.has(theme.id);
                    return (
                      <div key={theme.id} style={{
                        background: 'var(--adm-bg)', border: `1px solid ${themeMarked ? 'rgba(239,68,68,0.3)' : 'var(--adm-border)'}`,
                        padding: '0.85rem 1rem',
                        opacity: themeMarked ? 0.6 : 1,
                        transition: 'all 0.2s',
                      }}>
                        {/* Fila del tema */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                          <span style={{
                            fontFamily: "'DM Mono', monospace", fontSize: '0.72rem',
                            textTransform: 'uppercase', letterSpacing: '0.1em',
                            color: themeMarked ? '#ef4444' : 'var(--gold)',
                            textDecoration: themeMarked ? 'line-through' : 'none',
                          }}>
                            <i className="bi bi-folder-fill me-2" style={{ fontSize: '0.7rem' }}></i>
                            {theme.name}
                          </span>
                          {!isProtected && (
                            <button
                              onClick={() => toggleDeleteTheme(theme.id)}
                              title={themeMarked ? 'Cancelar eliminación' : 'Eliminar tema completo'}
                              style={{
                                background: 'transparent',
                                border: `1px solid ${themeMarked ? 'rgba(239,68,68,0.5)' : 'var(--adm-border)'}`,
                                color: themeMarked ? '#ef4444' : 'var(--adm-muted)',
                                padding: '0.2rem 0.45rem', cursor: 'pointer', fontSize: '0.7rem',
                                transition: '0.15s', borderRadius: '2px',
                              }}
                            >
                              <i className={`bi ${themeMarked ? 'bi-arrow-counterclockwise' : 'bi-trash3'}`}></i>
                            </button>
                          )}
                          {isProtected && (
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', color: 'var(--adm-muted)', opacity: 0.5 }}>
                              protegido
                            </span>
                          )}
                        </div>

                        {/* Chips de subtemas */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {theme.subthemes.map((sub) => {
                            const subMarked = deleteSubIds.has(sub.id);
                            const isSubProtected = isProtected && sub.name.toLowerCase() === 'otros';
                            return (
                              <span
                                key={sub.id}
                                style={S.chipDel(subMarked)}
                                onClick={() => !isSubProtected && !themeMarked && toggleDeleteSub(sub.id)}
                                title={isSubProtected ? 'No se puede eliminar' : subMarked ? 'Cancelar' : 'Marcar para eliminar'}
                              >
                                {subMarked
                                  ? <i className="bi bi-x-circle-fill" style={{ fontSize: '0.7rem' }}></i>
                                  : !isSubProtected && <i className="bi bi-x" style={{ fontSize: '0.7rem', opacity: 0 }} className="del-icon"></i>
                                }
                                {sub.name}
                                {isSubProtected && <i className="bi bi-lock-fill" style={{ fontSize: '0.6rem', opacity: 0.4 }}></i>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {totalToDelete > 0 && (
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: '#ef4444', marginTop: '0.6rem', opacity: 0.8 }}>
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  Los archivos en categorías eliminadas pasarán a "General / Otros".
                </p>
              )}

              {/* ─── AÑADIR CATEGORÍAS (EDIT) ─── */}
              <div style={S.divider}>
                <i className="bi bi-plus-circle-fill"></i>
                <span>Añadir categorías</span>
                <span style={S.dividerLine}></span>
              </div>

              {catalogForAdd.length === 0 && !loadingCatalog ? (
                <p style={{ color: 'var(--adm-muted)', fontSize: '0.8rem', fontFamily: "'DM Mono', monospace" }}>
                  El usuario ya tiene todos los subtemas disponibles.
                </p>
              ) : (
                <>
                  <label style={S.fieldLabel}>Subtemas disponibles para agregar</label>
                  <CategoriesDropdown
                    availableCategories={catalogForAdd}
                    selectedTopics={newTopics}
                    onToggle={handleToggleAdd}
                    loading={loadingCatalog}
                    placeholder="Seleccionar subtemas a añadir..."
                  />
                  {totalToAdd > 0 && (
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--gold)', marginTop: '0.5rem' }}>
                      <i className="bi bi-plus-circle me-1"></i>
                      {totalToAdd} subtema{totalToAdd !== 1 ? 's' : ''} nuevo{totalToAdd !== 1 ? 's' : ''} a agregar.
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {/* ─── ACCIONES ─── */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                flex: 1, background: 'var(--accent)', border: 'none',
                color: '#fff', fontFamily: "'DM Mono', monospace",
                fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '0.75rem', cursor: isSaving ? 'wait' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              {isSaving && (
                <span style={{
                  width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite', display: 'inline-block',
                }} />
              )}
              {isNew ? 'Crear usuario' : 'Guardar cambios'}
            </button>
            <button
              onClick={onClose}
              disabled={isSaving}
              style={{
                flex: 1, background: 'transparent',
                border: '1px solid var(--adm-border)', color: 'var(--adm-muted)',
                fontFamily: "'DM Mono', monospace", fontSize: '0.75rem',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '0.75rem', cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   VISTAS
═══════════════════════════════════════════════ */

/* ── Overview ── */
function ViewOverview({ stats, nodes, articles, replications }) {
  const nodesUp   = nodes.filter((n) => n.status === 'up').length;
  const pending   = replications.filter((t) => t.status === 'pending').length;
  const failed    = replications.filter((t) => t.status === 'failed').length;
  const available = articles.filter((a) => a.status === 'available').length;

  const SUMMARY_CARDS = [
    { title: 'Estado de Nodos',        icon: 'bi-hdd-network-fill', color: '#22c55e', content: `${nodesUp} online · ${nodes.length - nodesUp} offline` },
    { title: 'Tareas de Replicación',  icon: 'bi-arrow-repeat',     color: '#eab308', content: `${pending} pendientes · ${failed} con error` },
    { title: 'Inventario de Archivos', icon: 'bi-database-fill',    color: 'var(--gold)', content: `${available} disponibles · ${articles.length} totales` },
  ];

  return (
    <>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 0.9, color: 'var(--adm-paper)', margin: 0 }}>
          Panel <span style={{ color: 'var(--accent)' }}>Administrador</span>
        </h1>
        <p style={{ color: 'var(--adm-muted)', margin: '0.5rem 0 0', fontSize: '0.8rem' }}>Vista general del sistema Scidist-Archive</p>
      </div>
      <div className="adm-stats-row" style={{ marginBottom: '2.5rem' }}>
        {stats.map((s) => (
          <div key={s.label} className="adm-stat-card">
            <span className="adm-stat-num" style={{ color: s.color }}>{s.value}</span>
            <span className="adm-stat-label">{s.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
        {SUMMARY_CARDS.map((card) => (
          <div key={card.title} style={{ background: 'var(--adm-surface)', border: '1px solid var(--adm-border)', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ width: 48, height: 48, background: `${card.color}20`, border: `1px solid ${card.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`bi ${card.icon}`} style={{ fontSize: '1.3rem', color: card.color }}></i>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--adm-paper)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{card.title}</div>
              <div style={{ color: 'var(--adm-muted)', fontSize: '0.75rem' }}>{card.content}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Usuarios ── */
function ViewUsers({ state, onCreateUser, onUpdateUser, onDeleteUser }) {
  const { data: users, loading, error } = state;
  const [modal,      setModal]      = useState(null);  // null | 'new' | user object
  const [isSaving,   setIsSaving]   = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);  // _id en proceso

  const handleSave = async (payload) => {
    setIsSaving(true);
    try {
      if (modal === 'new') await onCreateUser(payload);
      else                 await onUpdateUser(modal._id, payload);
      setModal(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`¿Eliminar "${user.username}"?\nSe eliminarán sus temas y subtemas.`)) return;
    setIsDeleting(user._id);
    try { await onDeleteUser(user._id); }
    finally { setIsDeleting(null); }
  };

  return (
    <>
      {modal && (
        <UserModal
          user={modal === 'new' ? null : modal}
          onClose={() => !isSaving && setModal(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <SectionHeader
          title="Gestión de"
          accent="Usuarios"
          sub={loading ? 'Cargando...' : `${users.length} cuentas registradas`}
        />
        <button onClick={() => setModal('new')} disabled={loading} style={{
          background: 'var(--accent)', border: 'none', color: '#fff',
          fontFamily: "'DM Mono', monospace", fontSize: '0.75rem',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          padding: '0.65rem 1.5rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          opacity: loading ? 0.5 : 1,
        }}>
          <i className="bi bi-person-plus-fill"></i> Nuevo Usuario
        </button>
      </div>

      {(loading || error || users.length === 0) ? (
        <SectionState loading={loading} error={error} empty={!loading && !error && users.length === 0} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {users.map((user) => {
            const initials = user.username.split('.').map((p) => p[0]?.toUpperCase()).join('') || '??';
            const hue = user._id.charCodeAt(2) * 37 % 360;
            const deleting = isDeleting === user._id;

            return (
              <div key={user._id} style={{
                background: 'var(--adm-surface)', border: '1px solid var(--adm-border)',
                padding: '1.5rem', transition: 'border-color 0.2s, transform 0.2s',
                position: 'relative', overflow: 'hidden', opacity: deleting ? 0.4 : 1,
              }}
                onMouseEnter={(e) => { if (!deleting) { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--adm-border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `hsl(${hue}, 60%, 50%)` }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', marginTop: '0.5rem' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: `hsl(${hue}, 60%, 20%)`, border: `2px solid hsl(${hue}, 60%, 40%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', color: `hsl(${hue}, 80%, 70%)`, flexShrink: 0 }}>
                    {deleting ? <i className="bi bi-hourglass-split" style={{ fontSize: '0.9rem' }}></i> : initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--adm-paper)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</div>
                    <div style={{ color: 'var(--adm-muted)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--adm-border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--adm-muted)' }}>
                    <i className="bi bi-calendar3 me-1"></i>{formatDate(user.createdAt)}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setModal(user)} disabled={deleting} title="Editar"
                      style={{ background: 'transparent', border: '1px solid var(--adm-border)', color: 'var(--gold)', padding: '0.35rem 0.6rem', cursor: 'pointer', transition: '0.2s', fontSize: '0.8rem' }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--adm-border)')}
                    ><i className="bi bi-pencil-fill"></i></button>
                    <button onClick={() => handleDelete(user)} disabled={deleting} title="Eliminar"
                      style={{ background: 'transparent', border: '1px solid var(--adm-border)', color: '#ef4444', padding: '0.35rem 0.6rem', cursor: deleting ? 'wait' : 'pointer', transition: '0.2s', fontSize: '0.8rem' }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--adm-border)')}
                    ><i className={`bi ${deleting ? 'bi-hourglass-split' : 'bi-trash-fill'}`}></i></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ── Salud de Nodos ── */
function ViewNodeHealth({ state }) {
  const { data: nodes, loading, error } = state;
  return (
    <>
      <SectionHeader title="Salud de" accent="Nodos" sub={loading ? 'Cargando...' : `${nodes.filter((n) => n.status === 'up').length} de ${nodes.length} nodos online`} />
      {(loading || error || nodes.length === 0) ? (
        <SectionState loading={loading} error={error} empty={!loading && !error && nodes.length === 0} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {nodes.map((node) => {
            const isUp = node.status === 'up';
            return (
              <div key={node.node_id} style={{ background: 'var(--adm-surface)', border: `1px solid ${isUp ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: isUp ? '#22c55e' : '#ef4444' }} />
                <div style={{ paddingLeft: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', color: 'var(--adm-paper)', fontWeight: 600 }}>
                      <i className={`bi bi-hdd-network${isUp ? '-fill' : ''} me-2`} style={{ color: isUp ? '#22c55e' : '#ef4444' }}></i>
                      {node.node_id}
                    </span>
                    <StatusBadge status={node.status} />
                  </div>
                  <div style={{ color: 'var(--adm-muted)', fontSize: '0.75rem', marginBottom: '0.35rem' }}><i className="bi bi-clock me-1 opacity-50"></i>Último latido: {timeAgo(node.last_heartbeat)}</div>
                  <div style={{ color: 'var(--adm-muted)', fontSize: '0.75rem' }}><i className="bi bi-wifi me-1 opacity-50"></i>{node.address}</div>
                  <div style={{ marginTop: '1rem', padding: '0.5rem 0.75rem', background: 'var(--adm-bg)', fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--adm-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: isUp ? '#22c55e' : '#ef4444', boxShadow: isUp ? '0 0 6px #22c55e' : 'none', animation: isUp ? 'pulse 2s infinite' : 'none', display: 'inline-block' }} />
                    {isUp ? 'Conectado y respondiendo' : 'Sin respuesta'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ── Nodos Activos ── */
function ViewActiveNodes({ state }) {
  const { data: nodes, loading, error } = state;
  return (
    <>
      <SectionHeader title="Nodos" accent="Activos" sub="Directorio de nodos registrados en el sistema" />
      {(loading || error || nodes.length === 0) ? (
        <SectionState loading={loading} error={error} empty={!loading && !error && nodes.length === 0} />
      ) : (
        <AdminTable
          cols={['Node ID', 'Dirección', 'Estado', 'Último visto']}
          rows={nodes.map((n) => [
            <code style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>{n.node_id}</code>,
            <code style={{ color: 'var(--adm-paper)', fontSize: '0.8rem' }}>{n.address}</code>,
            <StatusBadge status={n.status} />,
            <span style={{ color: 'var(--adm-muted)', fontSize: '0.75rem' }}>{timeAgo(n.last_seen)}</span>,
          ])}
        />
      )}
    </>
  );
}

/* ── Tareas de Replicación ── */
function ViewReplication({ state }) {
  const { data: tasks, loading, error } = state;
  const TYPE_COLOR = { REPLICATE: '#3b82f6', DELETE: '#ef4444' };
  return (
    <>
      <SectionHeader title="Tareas de" accent="Replicación" sub={loading ? 'Cargando...' : `${tasks.filter((t) => t.status === 'pending').length} pendientes · ${tasks.filter((t) => t.status === 'failed').length} fallidas`} />
      {(loading || error || tasks.length === 0) ? (
        <SectionState loading={loading} error={error} empty={!loading && !error && tasks.length === 0} />
      ) : (
        <AdminTable
          cols={['Hash', 'Tipo', 'Origen', 'Destino', 'Estado', 'Reintentos', 'Fecha']}
          rows={tasks.map((t) => [
            <code style={{ color: 'var(--gold)', fontSize: '0.75rem' }}>{hashShort(t.file_hash)}</code>,
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: TYPE_COLOR[t.task_type] || '#9ca3af', textTransform: 'uppercase' }}>{t.task_type}</span>,
            <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>{t.source_node}</span>,
            <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>{t.target_node}</span>,
            <StatusBadge status={t.status} />,
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: t.retry_count > 0 ? '#eab308' : 'var(--adm-muted)' }}>{t.retry_count}</span>,
            <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)' }}>{formatDate(t.createdAt)}</span>,
          ])}
        />
      )}
    </>
  );
}

/* ── Mapas de Almacenamiento ── */
function ViewStorageMaps({ state }) {
  const { data: maps, loading, error } = state;
  return (
    <>
      <SectionHeader title="Mapas de" accent="Almacenamiento" sub={loading ? 'Cargando...' : `${maps.length} registros · ${maps.filter((m) => m.is_primary).length} primarios`} />
      {(loading || error || maps.length === 0) ? (
        <SectionState loading={loading} error={error} empty={!loading && !error && maps.length === 0} />
      ) : (
        <AdminTable
          cols={['Hash', 'Nodo', 'Primario', 'Versión', 'Estado']}
          rows={maps.map((m) => [
            <code style={{ color: 'var(--gold)', fontSize: '0.75rem' }}>{hashShort(m.file_hash)}</code>,
            <code style={{ fontSize: '0.75rem', color: 'var(--adm-paper)' }}>{m.node_id}</code>,
            m.is_primary ? <span style={{ color: '#22c55e', fontSize: '0.75rem' }}><i className="bi bi-star-fill me-1"></i>Sí</span> : <span style={{ color: 'var(--adm-muted)', fontSize: '0.75rem' }}>No</span>,
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', color: 'var(--adm-paper)' }}>v{m.version}</span>,
            <StatusBadge status={m.status} />,
          ])}
        />
      )}
    </>
  );
}

/* ── Artículos ── */
function ViewArticles({ state }) {
  const { data: articles, loading, error } = state;
  return (
    <>
      <SectionHeader title="Artículos del" accent="Sistema" sub={loading ? 'Cargando...' : `${articles.length} artículos indexados`} />
      {(loading || error || articles.length === 0) ? (
        <SectionState loading={loading} error={error} empty={!loading && !error && articles.length === 0} />
      ) : (
        <AdminTable
          cols={['Título', 'Hash', 'Propietario', 'Tema', 'Estado', 'Registrado']}
          rows={articles.map((a) => [
            <span style={{ color: 'var(--adm-paper)', fontSize: '0.85rem', fontWeight: 500 }}>{a.title || '—'}</span>,
            <code style={{ color: 'var(--gold)', fontSize: '0.75rem' }}>{hashShort(a.file_hash)}</code>,
            <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>{a.owner_id?.username || '—'}</span>,
            <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>{a.theme_id?.name || '—'}</span>,
            <StatusBadge status={a.status} />,
            <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)' }}>{formatDate(a.createdAt)}</span>,
          ])}
        />
      )}
    </>
  );
}

/* ── Gráficas ── */
function ViewCharts() {
  const PLACEHOLDERS = [
    { icon: 'bi-bar-chart-line-fill', label: 'Archivos por categoría',  color: '#3b82f6' },
    { icon: 'bi-pie-chart-fill',      label: 'Distribución por nodo',   color: '#c9a84c' },
    { icon: 'bi-graph-up-arrow',      label: 'Crecimiento mensual',     color: '#22c55e' },
    { icon: 'bi-activity',            label: 'Latencia de replicación', color: '#e63946' },
  ];
  return (
    <>
      <SectionHeader title="Panel de" accent="Gráficas" sub="Visualizaciones · Próximamente disponibles" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {PLACEHOLDERS.map((p) => (
          <div key={p.label} style={{ background: 'var(--adm-surface)', border: '1px dashed var(--adm-border)', padding: '2.5rem 1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <i className={`bi ${p.icon}`} style={{ fontSize: '2.5rem', color: p.color, opacity: 0.5 }}></i>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--adm-muted)' }}>{p.label}</div>
            <span style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold)', fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', padding: '0.2rem 0.75rem', letterSpacing: '0.1em' }}>PRÓXIMAMENTE</span>
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

  const [usersState,        setUsersState]        = useState(EMPTY_STATE);
  const [nodesState,        setNodesState]        = useState(EMPTY_STATE);
  const [articlesState,     setArticlesState]     = useState(EMPTY_STATE);
  const [replicationsState, setReplicationsState] = useState(EMPTY_STATE);
  const [storageMapsState,  setStorageMapsState]  = useState(EMPTY_STATE);

  /* ── Fetch functions ── */
  const fetchUsers = useCallback(async () => {
    setUsersState((p) => ({ ...p, loading: true, error: null }));
    try {
      const { data } = await api.get('/admin/users', { headers: adminHeaders() });
      setUsersState({ data, loading: false, error: null });
    } catch (e) {
      setUsersState((p) => ({ ...p, loading: false, error: e.response?.data?.error || 'Error al cargar usuarios' }));
    }
  }, []);

  const fetchNodes = useCallback(async () => {
    setNodesState((p) => ({ ...p, loading: true, error: null }));
    try {
      const { data } = await api.get('/admin/nodes', { headers: adminHeaders() });
      setNodesState({ data, loading: false, error: null });
    } catch (e) {
      setNodesState((p) => ({ ...p, loading: false, error: e.response?.data?.error || 'Error al cargar nodos' }));
    }
  }, []);

  const fetchArticles = useCallback(async () => {
    setArticlesState((p) => ({ ...p, loading: true, error: null }));
    try {
      const { data } = await api.get('/admin/articles', { headers: adminHeaders() });
      setArticlesState({ data, loading: false, error: null });
    } catch (e) {
      setArticlesState((p) => ({ ...p, loading: false, error: e.response?.data?.error || 'Error al cargar artículos' }));
    }
  }, []);

  const fetchReplications = useCallback(async () => {
    setReplicationsState((p) => ({ ...p, loading: true, error: null }));
    try {
      const { data } = await api.get('/admin/replications', { headers: adminHeaders() });
      setReplicationsState({ data, loading: false, error: null });
    } catch (e) {
      setReplicationsState((p) => ({ ...p, loading: false, error: e.response?.data?.error || 'Error al cargar tareas' }));
    }
  }, []);

  const fetchStorageMaps = useCallback(async () => {
    setStorageMapsState((p) => ({ ...p, loading: true, error: null }));
    try {
      const { data } = await api.get('/admin/storage-maps', { headers: adminHeaders() });
      setStorageMapsState({ data, loading: false, error: null });
    } catch (e) {
      setStorageMapsState((p) => ({ ...p, loading: false, error: e.response?.data?.error || 'Error al cargar mapas' }));
    }
  }, []);

  /* ── Carga inicial ── */
  useEffect(() => {
    fetchUsers(); fetchNodes(); fetchArticles(); fetchReplications(); fetchStorageMaps();
  }, [fetchUsers, fetchNodes, fetchArticles, fetchReplications, fetchStorageMaps]);

  /* ── Refresco al cambiar de sección ── */
  useEffect(() => {
    const map = {
      users: fetchUsers, active_nodes: fetchNodes, node_health: fetchNodes,
      articles: fetchArticles, replication: fetchReplications, storage_maps: fetchStorageMaps,
    };
    map[activeSection]?.();
  }, [activeSection, fetchUsers, fetchNodes, fetchArticles, fetchReplications, fetchStorageMaps]);

  /* ────────────────────────────────────────────────
     CRUD USUARIOS
     · CREATE usa /auth/register (mismo flujo que el registro)
     · UPDATE usa /admin/users/:id + endpoints de themes
  ──────────────────────────────────────────────── */
  const handleCreateUser = async ({ form, selectedTopics }) => {
    /* Construimos el body igual que el formulario de registro */
    await api.post('/auth/register', {
      username:    form.username,
      email:       form.email,
      password:    form.password,
      preferences: selectedTopics,   // { "Redes": ["Protocolos"], "Linux": ["Fedora"] }
    });
    await fetchUsers();
  };

  const handleUpdateUser = async (id, { form, deleteThemeIds, deleteSubIds, newTopics }) => {
    /* 1. Actualizar datos básicos */
    const basicPayload = { username: form.username, email: form.email };
    if (form.password) basicPayload.password = form.password;
    await api.put(`/admin/users/${id}`, basicPayload, { headers: adminHeaders() });

    /* 2. Eliminar temas marcados (en paralelo) */
    await Promise.all(
      [...deleteThemeIds].map((themeId) =>
        api.delete(`/admin/themes/${themeId}`, { headers: adminHeaders() })
      )
    );

    /* 3. Eliminar subtemas marcados (en paralelo) */
    await Promise.all(
      [...deleteSubIds].map((subId) =>
        api.delete(`/admin/subthemes/${subId}`, { headers: adminHeaders() })
      )
    );

    /* 4. Añadir nuevas categorías (si las hay) */
    const hasNewTopics = Object.values(newTopics).some((v) => v.length > 0);
    if (hasNewTopics) {
      await api.post(`/admin/users/${id}/themes`, { preferences: newTopics }, { headers: adminHeaders() });
    }

    await fetchUsers();
  };

  const handleDeleteUser = async (id) => {
    await api.delete(`/admin/users/${id}`, { headers: adminHeaders() });
    await fetchUsers();
  };

  /* ── Badges ── */
  const sectionBadges = useMemo(() => ({
    users:        usersState.data.length,
    articles:     articlesState.data.length,
    active_nodes: nodesState.data.length,
    node_health:  nodesState.data.filter((n) => n.status === 'down').length,
    storage_maps: storageMapsState.data.length,
    replication:  replicationsState.data.filter((t) => t.status === 'pending').length,
  }), [usersState, nodesState, articlesState, replicationsState, storageMapsState]);

  /* ── Stats ── */
  const stats = useMemo(() => [
    { label: 'Usuarios',          value: usersState.loading        ? '—' : usersState.data.length,                                                                                    color: 'var(--adm-paper)' },
    { label: 'Archivos',          value: articlesState.loading     ? '—' : articlesState.data.length,                                                                                  color: 'var(--gold)'      },
    { label: 'Nodos',             value: nodesState.loading        ? '—' : `${nodesState.data.filter((n) => n.status === 'up').length}/${nodesState.data.length}`,                     color: '#22c55e'          },
    { label: 'Tareas Pendientes', value: replicationsState.loading ? '—' : replicationsState.data.filter((t) => t.status === 'pending').length,                                       color: '#eab308'          },
  ], [usersState, articlesState, nodesState, replicationsState]);

  /* ── Router ── */
  const renderSection = () => {
    switch (activeSection) {
      case 'overview':     return <ViewOverview stats={stats} nodes={nodesState.data} articles={articlesState.data} replications={replicationsState.data} />;
      case 'users':        return <ViewUsers state={usersState} onCreateUser={handleCreateUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} />;
      case 'node_health':  return <ViewNodeHealth  state={nodesState} />;
      case 'active_nodes': return <ViewActiveNodes state={nodesState} />;
      case 'replication':  return <ViewReplication state={replicationsState} />;
      case 'storage_maps': return <ViewStorageMaps state={storageMapsState} />;
      case 'articles':     return <ViewArticles    state={articlesState} />;
      case 'charts':       return <ViewCharts />;
      default:             return <ViewOverview stats={stats} nodes={nodesState.data} articles={articlesState.data} replications={replicationsState.data} />;
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