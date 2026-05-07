// src/utils/helpers.js

// Íconos para las categorías
export const getIconForCategory = (name) => {
  if (!name || name === 'todos') return 'bi-grid-1x2';
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('ia') || lowerName.includes('inteligencia')) return 'bi-robot';
  if (lowerName.includes('redes')) return 'bi-hdd-network';
  if (lowerName.includes('dev') || lowerName.includes('desarrollo')) return 'bi-code-slash';
  if (lowerName.includes('linux')) return 'bi-ubuntu';
  if (lowerName.includes('general')) return 'bi-folder-symlink';
  
  return 'bi-folder2'; // Ícono por defecto
};

// Íconos y colores para los tipos de archivo en las tarjetas
export const getFileIcon = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  
  const icons = {
    pdf: 'bi-filetype-pdf text-danger',
    doc: 'bi-filetype-docx text-primary',
    docx: 'bi-filetype-docx text-primary',
    js: 'bi-filetype-js text-warning',
    py: 'bi-filetype-py text-info',
    jpg: 'bi-image text-success',
    png: 'bi-image text-success',
    txt: 'bi-filetype-txt text-secondary',
    zip: 'bi-file-zip text-muted'
  };
  
  return icons[ext] || 'bi-file-earmark text-muted';
};

// Convierte bytes a KB, MB, GB...
export const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// Formatea la fecha ISO a algo como "04 May 2026"
export const formatDate = (dateString) => {
  if (!dateString) return 'Fecha desconocida';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};