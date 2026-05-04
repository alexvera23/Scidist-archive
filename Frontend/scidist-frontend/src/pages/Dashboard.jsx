import React, { useState, useRef } from 'react';
import AppLayout from '../components/layout/AppLayout';

export default function Dashboard() {
  const [currentFilter, setCurrentFilter] = useState('todos');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Stats simuladas
  const stats = { total: 28, areas: 4, size: '1.2 GB', types: 3 };

  // Manejadores del Drag & Drop
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFiles = (files) => {
    console.log("Archivos listos para subir:", files);
    // TODO: Enviar al API Gateway por FormData
  };

  return (
    <AppLayout onSelectCategory={setCurrentFilter}>
      
      {/* HEADER DINÁMICO */}
      <div className="main-header mb-5">
        <h1 id="mainTitle">
          Archivos <span className="accent Titulo">{currentFilter === 'todos' ? 'Recientes' : currentFilter}</span> <i className="bi bi-folder-minus"></i>
        </h1>
        <p id="mainSub">Clasificación inteligente de recursos</p>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="row g-0 stats-row mb-5">
        <div className="col-6 col-md-3 stat-card">
          <span className="stat-card-num" id="statTotal">{stats.total}</span>
          <span className="stat-card-label">Totales</span>
        </div>
        <div className="col-6 col-md-3 stat-card">
          <span className="stat-card-num" id="statAreas">{stats.areas}</span>
          <span className="stat-card-label">Áreas</span>
        </div>
        <div className="col-6 col-md-3 stat-card">
          <span className="stat-card-num" id="statSize">{stats.size}</span>
          <span className="stat-card-label">Peso</span>
        </div>
        <div className="col-6 col-md-3 stat-card">
          <span className="stat-card-num" id="statTypes">{stats.types}</span>
          <span className="stat-card-label">Tipos</span>
        </div>
      </div>

      {/* DROP ZONE */}
      <div 
        className={`drop-zone mb-5 ${isDragging ? 'dragover' : ''}`} 
        id="dropZone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
        style={{ cursor: 'pointer' }}
      >
        <i className="bi bi-cloud-arrow-up fs-1 mb-3 d-block text-primary"></i>
        <p className="drop-title">Arrastra tus Archivos</p>
        <p className="drop-sub d-none d-sm-block text-muted">o haz clic para seleccionar</p>
        <button type="button" className="btn btn-outline-primary mt-3 px-4 rounded-pill">Examinar</button>
        <input 
          type="file" 
          ref={fileInputRef} 
          multiple 
          onChange={(e) => handleFiles(e.target.files)} 
          style={{ display: 'none' }}
        />
      </div>

      {/* ÁREA DE ARCHIVOS (Empty State por ahora) */}
      <div id="filesContainer">
        <div className="files-empty py-5 text-center" id="emptyState">
          <i className="bi bi-folder2-open display-1 opacity-25"></i>
          <p className="mt-3 text-muted">Aún no hay archivos subidos en {currentFilter}</p>
        </div>
        
        {/* Aquí irá el <div className="row g-3 files-grid"> cuando mapeemos los archivos */}
      </div>

    </AppLayout>
  );
}