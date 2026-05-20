import React from 'react';
import '../assets/css/index-styles.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const features = [
  {
    icon: 'bi-file-earmark-pdf',
    title: 'Carga de artículos PDF',
    text: 'Sube artículos científicos y visualiza su estado de análisis desde una interfaz limpia y ordenada.'
  },
  {
    icon: 'bi-diagram-3',
    title: 'Clasificación por áreas',
    text: 'Organiza documentos por áreas y subáreas como Computación, Medicina, Física, Humanidades o IA.'
  },
  {
    icon: 'bi-cpu',
    title: 'Análisis inteligente',
    text: 'El sistema interpreta el contenido del archivo para proponer categorías relevantes de forma automática.'
  },
  {
    icon: 'bi-search',
    title: 'Búsqueda académica',
    text: 'Encuentra artículos por nombre, tema, área, subárea o fecha sin perder tiempo revisando carpetas.'
  },
  {
    icon: 'bi-shield-check',
    title: 'Organización segura',
    text: 'Administra tus documentos desde una plataforma pensada para mantener tu biblioteca científica protegida.'
  },
  {
    icon: 'bi-bar-chart-line',
    title: 'Panel de estadísticas',
    text: 'Consulta cuántos artículos tienes por categoría, cuáles se analizaron y cómo crece tu repositorio.'
  }
];



const distributedFeatures = [
  {
    icon: 'bi-eye',
    title: 'Transparencia de acceso',
    text: 'El usuario interactúa con una sola plataforma, aunque internamente los documentos, servicios y análisis puedan ejecutarse en diferentes módulos o nodos.'
  },
  {
    icon: 'bi-hdd-network',
    title: 'Transparencia de ubicación',
    text: 'Los artículos se consultan desde el dashboard sin que el usuario tenga que saber en qué nodo, carpeta o servicio se encuentran almacenados.'
  },
  {
    icon: 'bi-files',
    title: 'Replicación de información',
    text: 'El diseño puede contemplar copias de seguridad o nodos espejo para mantener disponibilidad de archivos y metadatos ante fallos.'
  },
  {
    icon: 'bi bi-router',
    title: 'Tailscale VPN',
    text: 'Toda la comunicación interna entre contenedores Docker y máquinas físicas está securizada y unificada mediante Tailscale VPN, creando una red privada virtual (Mesh) de confianza cero sin exponer puertos públicos.'
  },
  {
    icon: 'bi-wifi',
    title: 'Comunicación entre servicios',
    text: 'La interfaz, el módulo de autenticación, el clasificador y el almacenamiento pueden comunicarse mediante peticiones cliente-servidor o APIs.'
  },
  {
    icon: 'bi-shield-exclamation',
    title: 'Tolerancia a fallos',
    text: 'Si un proceso de análisis falla, el sistema puede conservar el archivo, marcar su estado y permitir reintentar la clasificación sin perder datos.'
  },
  {
    icon: 'bi bi-diagram-2',
    title: 'Microservicios & gRPC',
    text : 'El API Gateway orquesta las peticiones hacia el Metadata Service(Node.js/Express). Las transferencias físicas de los PDFs se realizan mediante flujos binarios de alta velocidad utilizando el protocolo gRPC.'
  },
  {
    icon: 'bi bi-hdd-network',
    title: 'P2P & MongoDB',
    text: 'Los archivos se distribuyen dinámicamente entre nodos heterogéneos (Fedora Linux y Windows) mediante un sistema de latidos (Heartbeats) y replicación. Los metadatos están resguardados en un Replica Set de MongoDB'
  }
];

const steps = [
  'Sube tu artículo científico en PDF',
  'Scidist analiza el contenido y metadatos',
  'El documento se clasifica por área y subárea',
  'Consulta, filtra y administra tu biblioteca'
];

function Scidist() {
  return (
    <div className="scidist-page d-flex flex-column min-vh-100">
      <nav className="navbar navbar-expand-lg sticky-top custom-navbar">
        <div className="container-fluid px-4 px-lg-5">
          <a className="navbar-brand brand-logo m-0" href="#">
            Scidist<span>-Archive</span>
          </a>

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
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center gap-lg-4">
              <li className="nav-item">
                <a className="nav-link" href="#features">Funciones</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#distributed">Distribuido</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#process">Proceso</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#about">Acerca de</a>
              </li>
              <li className="nav-item">
                <a className="nav-login" href="/auth">Ingresar</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <main>
        <section className="hero-section">
          <div className="hero-content">
            <p className="hero-tag">
              <i className="bi bi-stars"></i>
              Clasificación inteligente de artículos científicos
            </p>

            <h1>
              Tu biblioteca académica, <span>ordenada en segundos.</span>
            </h1>

            <p className="hero-description">
              Scidist-Archive permite subir artículos científicos, analizarlos y clasificarlos automáticamente por áreas y subáreas para que tu investigación sea más fácil de consultar, filtrar y administrar.
            </p>

            <div className="hero-actions">
              <a href="/auth" className="fv-primary-btn">
                Comenzar ahora
                <i className="bi bi-arrow-right"></i>
              </a>
              <a href="#features" className="fv-secondary-btn">
                Ver funciones
              </a>
            </div>

            <div className="hero-trust">
              <div>
                <strong>PDF</strong>
                <span>Formato principal</span>
              </div>
              <div>
                <strong>IA</strong>
                <span>Clasificación asistida</span>
              </div>
              <div>
                <strong>Nodos</strong>
                <span>Diseño distribuido</span>
              </div>
            </div>
          </div>

          <div className="hero-dashboard" aria-label="Vista previa del dashboard de Scidist-Archive">
            <div className="dashboard-card main-card">
              <div className="dashboard-topbar">
                <div>
                  <span className="mini-label">Sistema distribuido académico</span>
                  <h3>Panel de artículos</h3>
                </div>
                <span className="status-pill">Analizando</span>
              </div>

              <div className="upload-box">
                <div className="upload-icon">
                  <i className="bi bi-cloud-arrow-up"></i>
                </div>
                <div>
                  <h4>Subir artículo PDF</h4>
                  <p>Arrastra tu documento para clasificarlo automáticamente.</p>
                </div>
              </div>

              <div className="article-list">
                <div className="article-row active">
                  <span className="pdf-icon">PDF</span>
                  <div>
                    <strong>Machine Learning in Medicine</strong>
                    <p>Área: Ciencias de la Salud · Subárea: IA Médica</p>
                  </div>
                  <i className="bi bi-check-circle-fill"></i>
                </div>

                <div className="article-row">
                  <span className="pdf-icon">PDF</span>
                  <div>
                    <strong>Quantum Computing Review</strong>
                    <p>Área: Ciencias Exactas · Subárea: Computación</p>
                  </div>
                  <i className="bi bi-hourglass-split"></i>
                </div>

                <div className="article-row">
                  <span className="pdf-icon">PDF</span>
                  <div>
                    <strong>Digital Archives & Knowledge</strong>
                    <p>Área: Humanidades · Subárea: Gestión Documental</p>
                  </div>
                  <i className="bi bi-check-circle-fill"></i>
                </div>
              </div>
            </div>

            <div className="floating-card categories-card">
              <span>Áreas detectadas</span>
              <strong>12+</strong>
              <div className="category-bars">
                <i></i><i></i><i></i>
              </div>
            </div>

            <div className="floating-card privacy-card">
              <i className="bi bi-lock-fill"></i>
              <span>Repositorio seguro</span>
            </div>
          </div>
        </section>

        <section className="stats-section">
          <div className="stat-card new-card">
            <strong>500+</strong>
            <span>Archivos organizados</span>
          </div>
          <div className="stat-card new-card">
            <strong>12+</strong>
            <span>Áreas de clasificación</span>
          </div>
          <div className="stat-card new-card">
            <strong>0.3s</strong>
            <span>Tiempo estimado de análisis</span>
          </div>
          <div className="stat-card new-card">
            <strong>3+</strong>
            <span>Servicios distribuidos</span>
          </div>
        </section>

        <section className="features-section" id="features">
          <div className="section-heading">
            <p>Funciones principales</p>
            <h2>Una plataforma para ordenar investigación, no solo guardar archivos.</h2>
          </div>

          <div className="features-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-icon">
                  <i className={`bi ${feature.icon}`}></i>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>


        <section className="distributed-section" id="distributed">
          <div className="section-heading distributed-heading">
            <p>Características de sistema distribuido</p>
            <h2>Scidist-Archive no solo clasifica archivos: modela una arquitectura distribuida.</h2>
          </div>

          <div className="distributed-layout">
            <div className="distributed-map" aria-label="Diagrama conceptual de arquitectura distribuida">
              <div className="node-card client-node">
                <i className="bi bi-window-sidebar"></i>
                <span>Cliente Web</span>
              </div>

              <div className="node-line"></div>

              <div className="node-card gateway-node">
                <i className="bi bi-diagram-3"></i>
                <span>Gateway / API</span>
              </div>

              <div className="node-cluster">
                <div className="node-card service-node">
                  <i className="bi bi-person-lock"></i>
                  <span>Autenticación</span>
                </div>
                <div className="node-card service-node">
                  <i className="bi bi-cpu"></i>
                  <span>Clasificador</span>
                </div>
                <div className="node-card service-node">
                  <i className="bi bi-database"></i>
                  <span>Almacenamiento</span>
                </div>
              </div>

              <div className="replica-row">
                <span>Nodo A</span>
                <span>Nodo B</span>
                <span>Nodo C</span>
              </div>
            </div>

            <div className="distributed-grid">
              {distributedFeatures.map((item) => (
                <article className="distributed-card" key={item.title}>
                  <div className="distributed-icon">
                    <i className={`bi ${item.icon}`}></i>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="process-section" id="process">
          <div className="process-copy">
            <p className="section-kicker">Flujo de trabajo</p>
            <h2>Del PDF desordenado a una biblioteca científica consultable.</h2>
            <p>
              La idea de Scidist-Archive es reducir el tiempo que pierdes buscando documentos. Como sistema distribuido, separa responsabilidades entre cliente, servicios de análisis, autenticación y almacenamiento para convertir tus artículos en registros organizados y consultables.
            </p>
          </div>

          <div className="process-steps">
            {steps.map((step, index) => (
              <div className="process-step" key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-section" id="about">
          <div>
            <p className="section-kicker">Scidist-Archive</p>
            <h2>Construye tu archivo científico inteligente.</h2>
            <p>
              Ideal para estudiantes, investigadores y equipos académicos que necesitan clasificar artículos, mantener orden documental y comprender una arquitectura con transparencia, concurrencia, tolerancia a fallos y servicios distribuidos.
            </p>
          </div>
          <a href="/auth" className="cta-button">
            Crear cuenta gratis
            <i className="bi bi-arrow-up-right"></i>
          </a>
        </section>
      </main>

      <footer className="footer-section">
        <div className="footer-logo">Scidist<span>-Archive</span></div>
        <p>© 2026 Scidist-Archive — Clasificador inteligente de artículos científicos.</p>
      </footer>
    </div>
  );
}

export default Scidist;
