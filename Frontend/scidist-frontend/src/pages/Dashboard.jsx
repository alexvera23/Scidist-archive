import React, { useState, useRef, useMemo, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
// Importa los helpers (deberás crearlos o ajustar la ruta)
import { getIconForCategory, getFileIcon, formatBytes, formatDate } from '../utils/helpers';
import api from '../api/axiosConfig';
import '../assets/css/app-styles.css';
import { Modal, Button, Spinner } from 'react-bootstrap';
// Datos de prueba (luego vendrán del backend)
// const MOCK_FILES = [
//   { id: 1, name: 'Arquitectura_P2P.pdf', size: '2.4 MB', date: '04 May 2026', category: 'Redes', subcategory: 'Topologías' },
//   { id: 2, name: 'modelo_entrenamiento.py', size: '15 KB', date: '03 May 2026', category: 'Inteligencia Artificial', subcategory: 'Machine Learning' },
//   { id: 3, name: 'server_gateway.js', size: '8 KB', date: '02 May 2026', category: 'Desarrollo de Software', subcategory: 'Backend' },
//   { id: 4, name: 'apuntes_protocolos.docx', size: '1.1 MB', date: '01 May 2026', category: 'Redes', subcategory: 'Protocolos' },
//   { id: 5, name: 'diagrama_db.png', size: '3.5 MB', date: '28 Abr 2026', category: 'General', subcategory: 'Otros' }
// ];

export default function Dashboard() {
  const [currentFilter, setCurrentFilter] = useState('todos');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // NUEVO: Estados para los archivos reales
  const [files, setFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Llave para forzar la recarga de la galería
  const [showModal, setShowModal] = useState(false);
  const [viewingUrl, setViewingUrl] = useState(null);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [activeFileTitle, setActiveFileTitle] = useState('');
  const [fileType, setFileType] = useState('pdf');

  useEffect(() => {
    const fetchFiles = async () => {
      setIsLoadingFiles(true);
      try {
        // Recuperamos el ID del usuario actual
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (!storedUser) return;

        const response = await api.get(`/files/user/${storedUser.id}`);
        setFiles(response.data);
      } catch (error) {
        console.error("Error al cargar los archivos:", error);
      } finally {
        setIsLoadingFiles(false);
      }
    };

    fetchFiles();
  }, [refreshKey]);

  // 1. Calcular conteos para los badges del Sidebar
  const fileCounts = useMemo(() => {
    const counts = { 'todos': files.length };
    files.forEach(file => {
      counts[file.category] = (counts[file.category] || 0) + 1;
      counts[file.subcategory] = (counts[file.subcategory] || 0) + 1;
    });
    return counts;
  }, [files]);

  // 2. Filtrar archivos según la categoría/subcategoría seleccionada
  const filteredFiles = useMemo(() => {
    if (currentFilter === 'todos') return files;
    return files.filter(file => 
      file.category === currentFilter || file.subcategory === currentFilter
    );
  }, [currentFilter, files]);

  // 3. Estadísticas reales basadas en los archivos totales (o filtrados si prefieres)
const stats = useMemo(() => {
    const totalSize = files.reduce((acc, file) => acc + (Number(file.size) || 0), 0);
    const uniqueTypes = new Set(files.map(f => f.name.split('.').pop().toLowerCase())).size;
    const uniqueAreas = new Set(files.map(f => f.category)).size;

    return {
      total: files.length,
      areas: uniqueAreas,
      size: formatBytes(totalSize),
      types: uniqueTypes
    };
  }, [files]);

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

const handleFiles = async (selectedFiles) => {
  const storedUser = JSON.parse(localStorage.getItem('user'));
  if (!storedUser) {
    alert("Sesión expirada. Por favor, inicia sesión de nuevo.");
    return;
  }

  setIsUploading(true);
  const filesArray = Array.from(selectedFiles);

  for (const file of filesArray) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-user-id': storedUser.id
        }
      });
      console.log(` ${file.name} subido con éxito`, response.data);
      alert('Archivo subido con éxito')
    } catch (error) {
      console.error(` Error al subir ${file.name}:`, error);
      const errorMsg = error.response?.data?.error || error.message;
      alert(`Fallo al subir ${file.name}: ${errorMsg}`);
    }
  }

  setIsUploading(false);
  setRefreshKey(prev => prev + 1);
};

  // Futuro manejador para abrir el archivo
  const handleViewFile = async (file) => {
  setActiveFileTitle(file.name);
  setIsViewLoading(true);
  setShowModal(true);

  const storedUser = JSON.parse(localStorage.getItem('user'));
  if (!storedUser?.id) return;

  try {
    const response = await api.get(`/download/${file.hash}`, {
      responseType: 'blob',
      headers: { 'x-user-id': storedUser.id }
    });

    const isPdf = file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      // 1. SOLUCIÓN AL DOWNLOAD: Forzamos el tipo application/pdf
      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      setViewingUrl(url);
      setFileType('pdf');
    } else {
      // 2. SOPORTE PARA TEXTO: Usamos FileReader como sugeriste
      const reader = new FileReader();
      reader.onload = (e) => {
        setViewingUrl(e.target.result); // Aquí guardamos el texto plano
        setFileType('text');
      };
      reader.readAsText(response.data);
    }
  } catch (error) {
    console.error("Error en el visor:", error);
    alert("No se pudo recuperar el archivo.");
    setShowModal(false);
  } finally {
    setIsViewLoading(false);
  }
};

// Limpieza de memoria al cerrar el modal
const handleCloseModal = () => {
  setShowModal(false);
  if (viewingUrl) {
    URL.revokeObjectURL(viewingUrl); // Liberamos la memoria del navegador
    setViewingUrl(null);
  }
};

// Función para Descargar el archivo físicamente
  const handleDownloadFile = async (file) => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (!storedUser || !storedUser.id) {
      return alert("Sesión expirada. Por favor, vuelve a iniciar sesión.");
    }

    try {
      const response = await api.get(`/download/${file.hash}`, {
        responseType: 'blob', // Necesario para descargar binarios
        headers: { 'x-user-id': storedUser.id }
      });

      // Crear un enlace temporal en el navegador para forzar la descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name); // Mantiene el nombre original
      document.body.appendChild(link);
      link.click();
      
      // Limpieza
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar:", error);
      alert("No se pudo descargar el archivo desde la red.");
    }
  };

  // Función para Eliminar el archivo
  const handleDeleteFile = async (file) => {
    const confirmar = window.confirm(`¿Estás seguro de que deseas eliminar "${file.name}"?`);
    if (!confirmar) return;

    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (!storedUser || !storedUser.id) {
      return alert("Sesión expirada. Por favor, vuelve a iniciar sesión.");
    }

    try {
      const response = await api.delete(`/delete/${file.hash}`, {
        headers: { 'x-user-id': storedUser.id }
      });
      
      console.log(response.data.message);
      
      // Forzamos la recarga de la galería cambiando el refreshKey
      setRefreshKey(prev => prev + 1); 
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert(error.response?.data?.error || "Error al eliminar el archivo.");
    }
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
        className={`drop-zone mb-5 ${isDragging ? 'dragover' : ''} ${isUploading ? 'opacity-50' : ''}`} 
        id="dropZone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current.click()}
        style={{ cursor: isUploading ? 'wait' : 'pointer' }}
      >
        {isUploading ? (
          <>
            <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}></div>
            <p className="drop-title">Subiendo y clasificando...</p>
            <p className="drop-sub text-muted">La Inteligencia Artificial está analizando tus archivos</p>
          </>
        ) : (
          <>
            <i className="bi bi-cloud-arrow-up fs-1 mb-3 d-block text-primary"></i>
            <p className="drop-title">Arrastra tus Archivos</p>
            <p className="drop-sub d-none d-sm-block text-muted">o haz clic para seleccionar</p>
            <button type="button" className="btn btn-outline-primary mt-3 px-4 rounded-pill">Examinar</button>
          </>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          multiple 
          onChange={(e) => handleFiles(e.target.files)} 
          style={{ display: 'none' }}
          disabled={isUploading}
        />
      </div>

      {/* GALERÍA DE ARCHIVOS */}
      <div id="filesContainer">
        {isLoadingFiles ? (
          <div className="py-5 text-center text-muted">
            <div className="spinner-border text-primary mb-3" role="status"></div>
            <p>Recuperando archivos de la red distribuida...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="files-empty py-5 text-center" id="emptyState">
            <i className="bi bi-folder-x display-1 opacity-25 text-muted"></i>
            <p className="mt-3 text-muted">Aún no hay archivos en esta categoría</p>
          </div>
        ) : (
          <div className="row g-4 files-grid">
            {filteredFiles.map(file => (
              <div key={file.id} className="col-12 col-md-6 col-lg-4 col-xl-3">
                <div 
                  className="card h-100 shadow-sm border-0 file-card" 
                  style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onClick={() => handleViewFile(file)}
                >
                  <div className="card-body d-flex flex-column">
                    <div className="mb-3 d-flex justify-content-between align-items-start">
                      <i className={`bi ${getFileIcon(file.name)}`} style={{ fontSize: '2rem' }}></i>
                      <div className="dropdown" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-link text-muted p-0" data-bs-toggle="dropdown">
                          <i className="bi bi-three-dots-vertical fs-5"></i>
                        </button>
                       <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0">
                        <li>
                          <button className="dropdown-item" onClick={() => handleDownloadFile(file)}>
                            <i className="bi bi-download me-2"></i>Descargar
                          </button>
                        </li>
                        <li><hr className="dropdown-divider" /></li>
                        <li>
                          <button className="dropdown-item text-danger" onClick={() => handleDeleteFile(file)}>
                            <i className="bi bi-trash me-2"></i>Eliminar
                          </button>
                        </li>
                      </ul>
                      </div>
                    </div>
                    
                    <div style={{ minHeight: '3.5rem' }}>
                      <h6 className="card-title fw-bold mb-1" style={{ color: 'var(--ink)', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {file.name}
                      </h6>
                    </div>
                    
                    {/* AQUI APLICAMOS LOS HELPERS */}
                    <div className="text-muted small mb-3 d-flex justify-content-between">
                      <span>{formatBytes(file.size)}</span>
                      <span>{formatDate(file.date)}</span>
                    </div>

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
      {/* VISOR DE ARCHIVOS (MODAL) */}
        <Modal 
          show={showModal} 
          onHide={handleCloseModal} 
          size="xl" 
          centered 
          className="file-viewer-modal"
          contentClassName="bg-dark text-white border-secondary"
        >
          <Modal.Header closeButton closeVariant="white" className="border-secondary">
            <Modal.Title className='Tittle'>
              Vista Previa: <span className="accent Titulo">{activeFileTitle}</span>
            </Modal.Title>
          </Modal.Header>
          
          <Modal.Body className="p-0" style={{ height: '80vh', backgroundColor: '#0d0f12', overflow: 'hidden' }}>
            {isViewLoading ? (
              <div className="h-100 d-flex flex-column align-items-center justify-content-center">
                <Spinner animation="border" variant="primary" className="mb-3" />
                <p className="font-monospace small opacity-50">SINCRONIZANDO BLOQUES...</p>
              </div>
            ) : (
              <>
                {fileType === 'pdf' ? (
                  /* USAMOS <embed> PARA PDF */
                  <embed
                    src={`${viewingUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    type="application/pdf"
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                  />
                ) : (
                  /* USAMOS <pre> PARA TEXTO PLANO / CÓDIGO */
                  <div className="p-4 h-100 overflow-auto">
                    <pre style={{ 
                      color: '#d1d5db', 
                      fontFamily: "'DM Mono', monospace", 
                      fontSize: '0.9rem',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap' 
                    }}>
                      {viewingUrl}
                    </pre>
                  </div>
                )}
              </>
            )}
          </Modal.Body>
          
          <Modal.Footer className="border-secondary bg-dark">
            <Button variant="outline" onClick={handleCloseModal} className="rounded-pill px-4 cerrar">
              Cerrar
            </Button>
            <Button 
              variant="outline" 
              className="rounded-pill px-4 complet"
              onClick={() => window.open(viewingUrl, '_blank')}
            >
              <i className="bi bi-box-arrow-up-right me-2"></i> Pantalla Completa
            </Button>
          </Modal.Footer>
        </Modal>

    </AppLayout>
  );
}