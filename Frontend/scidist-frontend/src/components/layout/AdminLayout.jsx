import React, { useState } from 'react';
import { Offcanvas } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../../assets/css/Dashboard-admi.css';

/* ─────────────────────────────────────────
   CONFIGURACIÓN DEL SIDEBAR
───────────────────────────────────────── */
const SIDEBAR_SECTIONS = [
  { id: 'overview',     label: 'Panel General',          icon: 'bi-grid-1x2-fill' },
  { id: 'divider1',     label: 'ENTIDADES',              isDivider: true },
  { id: 'users',        label: 'Usuarios',                icon: 'bi-people-fill' },
  { id: 'articles',     label: 'Artículos',               icon: 'bi-file-earmark-text-fill' },
  { id: 'divider2',     label: 'INFRAESTRUCTURA P2P',    isDivider: true },
  { id: 'active_nodes', label: 'Nodos Activos',           icon: 'bi-diagram-3-fill' },
  { id: 'node_health',  label: 'Salud de Nodos',          icon: 'bi-heart-pulse-fill' },
  { id: 'storage_maps', label: 'Mapas de Almacenamiento', icon: 'bi-database-fill' },
  { id: 'replication',  label: 'Tareas de Replicación',   icon: 'bi-arrow-repeat' },
  { id: 'divider3',     label: 'ANÁLISIS',                isDivider: true },
  { id: 'charts',       label: 'Gráficas',                icon: 'bi-bar-chart-fill' },
];

/* ─────────────────────────────────────────
   PROPS:
   · children        — contenido de la vista activa
   · activeSection   — string con el id de la sección activa
   · onSelectSection — callback(sectionId) al hacer clic en el sidebar
   · sectionBadges   — { [sectionId]: number } para los contadores del sidebar
   · stats           — [{ label, value, color }] para la barra de estadísticas
                       (no se muestra cuando activeSection === 'overview')
───────────────────────────────────────── */
export default function AdminLayout({
  children,
  activeSection,
  onSelectSection,
  sectionBadges = {},
  stats = [],
}) {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();

  const handleSelect = (id) => {
    onSelectSection(id);
    setShowSidebar(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  /* Secciones que muestran advertencia en su badge */
  const WARN_SECTIONS = new Set(['replication', 'node_health']);

  return (
    <div className="adm-root">

      {/* ── NAVBAR ── */}
      <nav className="adm-navbar">
        <div className="adm-navbar-inner">

          {/* Izquierda: menú + brand */}
          <div className="d-flex align-items-center gap-3">
            <button
              className="adm-btn-menu"
              type="button"
              onClick={() => setShowSidebar(true)}
            >
              <i className="bi bi-list" style={{ fontSize: '1.6rem' }}></i>
            </button>

            <a href="#" className="adm-brand">
              Scidist<span className="accent">-Admin</span>
            </a>

            <span className="adm-admin-chip d-none d-sm-inline">PANEL ADMIN</span>
          </div>

          {/* Derecha: usuario + logout */}
          <div className="d-flex align-items-center gap-3">
            <span
              className="d-none d-md-flex align-items-center gap-2"
              style={{ color: 'var(--adm-muted)', fontSize: '0.8rem' }}
            >
              <i className="bi bi-shield-check" style={{ color: 'var(--gold)' }}></i>
              Administrador
            </span>

            <button className="adm-btn-logout" type="button" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right"></i>
              <span className="d-none d-sm-inline">Salir</span>
            </button>
          </div>

        </div>
      </nav>

      {/* ── OFFCANVAS SIDEBAR ── */}
      <Offcanvas
        show={showSidebar}
        onHide={() => setShowSidebar(false)}
        placement="start"
        className="adm-sidebar"
      >
        <Offcanvas.Header closeButton>
          <div>
            <div className="adm-sidebar-label">SCIDIST — ADMIN</div>
            <div className="adm-sidebar-title">Panel de Control</div>
          </div>
        </Offcanvas.Header>

        <Offcanvas.Body>
          <nav className="adm-nav">
            {SIDEBAR_SECTIONS.map((item) => {
              if (item.isDivider) {
                return (
                  <div key={item.id} className="adm-divider">
                    {item.label}
                  </div>
                );
              }

              const count  = sectionBadges[item.id];
              const isWarn = WARN_SECTIONS.has(item.id);

              return (
                <button
                  key={item.id}
                  className={`adm-nav-item ${activeSection === item.id ? 'active' : ''}`}
                  onClick={() => handleSelect(item.id)}
                >
                  <span className="adm-nav-item-inner">
                    <i className={`bi ${item.icon}`}></i>
                    {item.label}
                  </span>

                  {count !== undefined && (
                    <span className={`adm-badge ${isWarn && count > 0 ? 'warn' : ''}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </Offcanvas.Body>
      </Offcanvas>

      {/* ── MAIN ── */}
      <main className="adm-main">

        {/* Barra de stats (oculta en la vista overview, que la renderiza internamente) */}
        {activeSection !== 'overview' && stats.length > 0 && (
          <div className="adm-stats-row">
            {stats.map((s) => (
              <div key={s.label} className="adm-stat-card">
                <span className="adm-stat-num" style={{ color: s.color }}>
                  {s.value}
                </span>
                <span className="adm-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {children}
      </main>

      {/* ── FOOTER ── */}
      <footer className="adm-footer">
        <div className="adm-footer-logo">Scidist-Archive</div>
        <p className="adm-footer-note">
          © 2026 Scidist-Archive — Panel Administrativo
        </p>
      </footer>

    </div>
  );
}