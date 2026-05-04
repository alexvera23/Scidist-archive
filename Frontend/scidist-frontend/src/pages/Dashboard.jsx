import React, { useState, useRef, useMemo } from 'react';
import AppLayout from '../components/layout/AppLayout';
// Importa los helpers (deberás crearlos o ajustar la ruta)
import { getIconForCategory, getFileIcon } from '../utils/helpers';

// Datos de prueba (luego vendrán del backend)
const MOCK_FILES = [
  { id: 1, name: 'Arquitectura_P2P.pdf', size: '2.4 MB', date: '04 May 2026', category: 'Redes', subcategory: 'Topologías' },
  { id: 2, name: 'modelo_entrenamiento.py', size: '15 KB', date: '03 May 2026', category: 'Inteligencia Artificial', subcategory: 'Machine Learning' },
  { id: 3, name: 'server_gateway.js', size: '8 KB', date: '02 May 2026', category: 'Desarrollo de Software', subcategory: 'Backend' },
  { id: 4, name: 'apuntes_protocolos.docx', size: '1.1 MB', date: '01 May 2026', category: 'Redes', subcategory: 'Protocolos' },
  { id: 5, name: 'diagrama_db.png', size: '3.5 MB', date: '28 Abr 2026', category: 'General', subcategory: 'Otros' }
];

export default function Dashboard() {
  const [currentFilter, setCurrentFilter] = useState('todos');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // 1. Calcular conteos para los badges del Sidebar
  const fileCounts = useMemo(() => {
    const counts = { todos: MOCK_FILES.length };
    MOCK_FILES.forEach(file => {
      counts[file.category] = (counts[file.category] || 0) + 1;
      counts[file.subcategory] = (counts[file.subcategory] || 0) + 1;
    });
    return counts;
  }, []);

  // 2. Filtrar archivos según la categoría/subcategoría seleccionada
  const filteredFiles = useMemo(() => {
    if (currentFilter === 'todos') return MOCK_FILES;
    return MOCK_FILES.filter(file =>
      file.category === currentFilter || file.subcategory === currentFilter
    );
  }, [currentFilter]);

  // 3. Estadísticas reales basadas en los archivos totales (o filtrados si prefieres)
  const stats = useMemo(() => {
    const total = MOCK_FILES.length;
    const areas = new Set(MOCK_FILES.map(f => f.category)).size;
    const totalSizeMB = MOCK_FILES.reduce((acc, f) => {
      const size = parseFloat(f.size);
      return acc + (f.size.includes('MB') ? size : size / 1024);
    }, 0);
    const types = new Set(MOCK_FILES.map(f => f.name.split('.').pop())).size;
    return {
      total,
      areas,
      size: `${totalSizeMB.toFixed(1)} MB`,
      types
    };
  }, []);

  // Manejadores Drag & Drop (igual que antes)
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      console.log("Archivos listos para subir:", e.dataTransfer.files);
      // Aquí irá la lógica de subida al backend
    }
  };
  const handleFiles = (files) => {
    console.log("Archivos seleccionados:", files);
  };

  // Futuro manejador para abrir el archivo
  const handleViewFile = (file) => {
    console.log("Abriendo visor para:", file.name);
    // Aquí a futuro:
    // 1. Haremos un GET al Gateway para traer el archivo físico desde los nodos de Windows.
    // 2. Si es PDF/IMG, lo abriremos en un Modal o nueva pestaña.
    // 3. Si es DOCX/XLSX, usaremos una librería como react-file-viewer.
    alert(`Próximamente: Abriendo el archivo ${file.name} en el visor integrado.`);
  };

  return (
    <AppLayout onSelectCategory={setCurrentFilter} categoryCounts={fileCounts}>

      {/* HEADER DINÁMICO CON ÍCONO */}
      <div className="main-header mb-5 d-flex align-items-center gap-3">
        <i className={`bi ${getIconForCategory(currentFilter)}`} style={{ fontSize: '2.5rem', color: 'var(--accent)' }}></i>
        <div>
          <h1 className="m-0">
            Archivos <span className="accent Titulo">
              {currentFilter === 'todos' ? 'Recientes' : currentFilter}
            </span>
          </h1>
          <p className="text-muted m-0 mt-1">Clasificación inteligente de recursos</p>
        </div>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS (con datos reales) */}
      <div className="row g-0 stats-row mb-5">
        <div className="col-6 col-md-3 stat-card">
          <span className="stat-card-num">{stats.total}</span>
          <span className="stat-card-label">Totales</span>
        </div>
        <div className="col-6 col-md-3 stat-card">
          <span className="stat-card-num">{stats.areas}</span>
          <span className="stat-card-label">Áreas</span>
        </div>
        <div className="col-6 col-md-3 stat-card">
          <span className="stat-card-num">{stats.size}</span>
          <span className="stat-card-label">Peso</span>
        </div>
        <div className="col-6 col-md-3 stat-card">
          <span className="stat-card-num">{stats.types}</span>
          <span className="stat-card-label">Tipos</span>
        </div>
      </div>

      {/* DROP ZONE (sin cambios, solo adaptamos clases) */}
      <div
        className={`drop-zone mb-5 ${isDragging ? 'dragover' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
      >
        <i className="bi bi-cloud-arrow-up fs-1 mb-3 d-block" style={{ color: 'var(--accent)' }}></i>
        <p className="drop-title">Arrastra tus Archivos</p>
        <p className="drop-sub d-none d-sm-block">o haz clic para seleccionar</p>
        <button type="button" className="btn-pick mt-3">Examinar</button>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
      </div>

      {/* GALERÍA DE ARCHIVOS */}
      <div id="filesContainer">
        {filteredFiles.length === 0 ? (
          <div className="files-empty py-5 text-center" id="emptyState">
            <i className="bi bi-folder-x display-1 opacity-25 text-muted"></i>
            <p className="mt-3 text-muted">Aún no hay archivos en esta categoría</p>
          </div>
        ) : (
          <div className="row g-4 files-grid">
            {filteredFiles.map(file => (
              <div key={file.id} className="col-12 col-md-6 col-lg-4 col-xl-3">
                
                {/* 1. LA TARJETA AHORA ES CLIQUEABLE */}
                <div 
                  className="card h-100 shadow-sm border-0 file-card new-card" 
                  style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onClick={() => handleViewFile(file)}
                >
                  <div className="card-body d-flex flex-column">
                    
                    {/* Ícono de tipo de archivo y Dropdown */}
                    <div className="mb-3 d-flex justify-content-between align-items-start">
                      <i className={`bi ${getFileIcon(file.name)}`} style={{ fontSize: '2rem' }}></i>
                      
                      {/* 2. STOP PROPAGATION: Aislamos el clic del menú */}
                      <div className="dropdown" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-link text-muted p-0" data-bs-toggle="dropdown">
                          <i className="bi bi-three-dots-vertical fs-5"></i>
                        </button>
                        <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0">
                          <li><button className="dropdown-item"><i className="bi bi-download me-2"></i>Descargar</button></li>
                          <li><hr className="dropdown-divider" /></li>
                          <li><button className="dropdown-item text-danger"><i className="bi bi-trash me-2"></i>Eliminar</button></li>
                        </ul>
                      </div>
                    </div>
                    
                    {/* 3. ALINEACIÓN PERFECTA: Altura fija para la zona de texto */}
                    <div style={{ minHeight: '3.5rem' }}>
                      <h6 className="card-title fw-bold mb-1" style={{ color: 'var(--ink)', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {file.name}
                      </h6>
                    </div>
                    
                    <div className="text-muted small mb-3 d-flex justify-content-between">
                      <span>{file.size}</span>
                      <span>{file.date}</span>
                    </div>

                    {/* Badges al fondo (siempre alineados gracias al mt-auto) */}
                    <div className="mt-auto d-flex flex-wrap gap-1">
                      <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle rounded-pill">
                        {file.category}
                      </span>
                      <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle rounded-pill">
                        {file.subcategory}
                      </span>
                    </div>

                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </AppLayout>
  );
}