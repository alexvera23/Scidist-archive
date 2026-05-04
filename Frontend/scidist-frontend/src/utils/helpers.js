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