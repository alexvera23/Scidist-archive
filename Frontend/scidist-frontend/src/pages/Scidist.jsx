import React from 'react';
import '../assets/css/index-styles.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

function Scidist() {
  return (
    <div className="d-flex flex-column min-vh-100">

      {/* NAVBAR */}
      <nav className="navbar navbar-expand-lg sticky-top custom-navbar">
        <div className="container-fluid px-4">

          <div className="d-flex align-items-center">
            <a className="navbar-brand brand-logo m-0" href="#">
              Scidist<span className="accent">-Archive</span>
            </a>
          </div>

          <button
            className="navbar-toggler custom-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarSupportedContent"
            aria-controls="navbarSupportedContent"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navbarSupportedContent">
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center gap-lg-3">

              <li className="nav-item">
                <a className="nav-link" href="#features">
                  Funciones
                </a>
              </li>

              <li className="nav-item">
                <a className="nav-link" href="#about">
                  Acerca de
                </a>
              </li>

              <li className="nav-item">
                <a className="btn btn-success btn-ingresar" href="/auth">
                  Ingresar
                </a>
              </li>

            </ul>
          </div>

        </div>
      </nav>

      {/* MAIN */}
      <main>

        {/* HERO */}
        <section className="hero">

          <div className="hero-text">
            <p className="hero-eyebrow">
              Clasificación Inteligente de Artículos Científicos
            </p>

            <h1>
              Organiza tu <em>Mundo</em> Digital
            </h1>

            <p className="hero-desc">
              Sube cualquier artículo científico y Scidist-Archive los
              clasifica automáticamente por áreas y sub-áreas en segundos.
            </p>

            <div className="hero-actions">
              <a href="/login" className="btn-primary">
                Comenzar Gratis
              </a>

              <a href="#features" className="btn-secondary">
                Ver funciones
              </a>
            </div>
          </div>

          <div className="hero-visual">

            <div className="file-stack">

              <div className="file-card">
                <span className="file-card-ext">PDF</span>
                <p className="file-card-name">Computación</p>
                <div className="file-card-bar"></div>
              </div>

              <div className="file-card">
                <span className="file-card-ext">PDF</span>
                <p className="file-card-name">Física</p>
                <div className="file-card-bar"></div>
              </div>

              <div className="file-card">
                <span className="file-card-ext">PDF</span>
                <p className="file-card-name">IA</p>
                <div className="file-card-bar"></div>
              </div>

            </div>

          </div>

        </section>

        {/* STATS */}
        <div className="stats-strip">

          <div className="stat-item">
            <span className="stat-num">
              500<span>+</span>
            </span>
            <span className="stat-label">Archivos almacenados</span>
          </div>

          <div className="stat-item">
            <span className="stat-num">
              12<span>+</span>
            </span>
            <span className="stat-label">Áreas de Clasificación</span>
          </div>

          <div className="stat-item">
            <span className="stat-num">
              0.3<span>s</span>
            </span>
            <span className="stat-label">Tiempo de Análisis</span>
          </div>

          <div className="stat-item">
            <span className="stat-num">
              100<span>%</span>
            </span>
            <span className="stat-label">Privacidad Local</span>
          </div>

        </div>

        {/* FEATURES */}
        <section className="features" id="features">

          <div className="section-header">

            <div>
              <p className="section-label">
                // 01 — Capacidades
              </p>

              <h2>Todo lo que Necesitas</h2>
            </div>

          </div>

          <div className="features-grid">

            <div className="feature-item">
              <span className="feature-icon">
                <i className="bi bi-file-earmark-pdf"></i>
              </span>

              <h3 className="feature-title">
                Formato PDF
              </h3>

              <p className="feature-desc">
                Soporte para archivos PDF
              </p>
            </div>

            <div className="feature-item">
              <span className="feature-icon">
                <i className="bi bi-folder-symlink"></i>
              </span>

              <h3 className="feature-title">
                Clasificación Inteligente
              </h3>

              <p className="feature-desc">
                Detecta áreas (Ciencias exactas, Ciencias Sociales,
                Literatura, etc.) y sub-áreas (Computación, Filosofía,
                Astrofísica).
              </p>
            </div>

            <div className="feature-item">
              <span className="feature-icon">
                <i className="bi bi-search-heart"></i>
              </span>

              <h3 className="feature-title">
                Análisis Detallado
              </h3>

              <p className="feature-desc">
                Extrae metadatos: tamaño, tema y fecha de modificación
                de cada archivo.
              </p>
            </div>

            <div className="feature-item">
              <span className="feature-icon">
                <i className="bi bi-lightning-charge"></i>
              </span>

              <h3 className="feature-title">
                Procesamiento Rápido
              </h3>

              <p className="feature-desc">
                Analiza múltiples archivos en paralelo con progreso
                en tiempo real.
              </p>
            </div>

            <div className="feature-item">
              <span className="feature-icon">
                <i className="bi bi-lock"></i>
              </span>

              <h3 className="feature-title">
                Autenticación Segura
              </h3>

              <p className="feature-desc">
                Sistema de registro e inicio de sesión con validación
                en tiempo real y sesiones persistentes.
              </p>
            </div>

            <div className="feature-item">
              <span className="feature-icon">
                <i className="bi bi-bar-chart"></i>
              </span>

              <h3 className="feature-title">
                Vista de Tablero
              </h3>

              <p className="feature-desc">
                Visualiza tus archivos organizados en tarjetas con
                filtros y estadísticas por categoría.
              </p>
            </div>

          </div>

        </section>

        {/* CTA */}
        <div className="cta-section" id="about">

          <div>
            <p
              className="section-label"
              style={{ color: 'var(--accent)' }}
            >
              // Únete Ahora
            </p>

            <h2>Empieza a Clasificar Hoy</h2>

            <p>
              Crea tu cuenta gratis y descubre cómo Scidist-Archive
              transforma el caos de archivos en orden perfecto.
            </p>
          </div>

          <div>
            <a href="/auth" className="btn-cta">
              Crear Cuenta Gratis
            </a>
          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer className="text-center py-3 mt-5">

        <div className="footer-logo">
          Scidist-Archive
        </div>

        <p className="footer-note">
          © 2026 Scidist-Archive — Clasificador Inteligente de Archivos
        </p>

      </footer>

    </div>
  );
}

export default Scidist;