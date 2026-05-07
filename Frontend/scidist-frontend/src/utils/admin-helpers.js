
export const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Vista General', icon: 'bi-speedometer2' },
  { id: 'nodes', label: 'Nodos de Almacenamiento', icon: 'bi-hdd-stack', isWarn: true },
  { id: 'users', label: 'Gestión de Usuarios', icon: 'bi-people' },
  { id: 'logs', label: 'Registros del Sistema', icon: 'bi-terminal' },
  { id: 'settings', label: 'Configuración', icon: 'bi-sliders' }
];

export const MOCK_USERS = [
    { _id: 'u1', username: 'ana.torres', email: 'ana@scidist.io', createdAt: '2026-01-15T10:00:00Z' },
  { _id: 'u2', username: 'luis.ramos', email: 'luis@scidist.io', createdAt: '2026-02-20T08:30:00Z' },
  { _id: 'u3', username: 'maria.lopez', email: 'maria@scidist.io', createdAt: '2026-03-05T14:00:00Z' },
  { _id: 'u4', username: 'carlos.mendez', email: 'carlos@scidist.io', createdAt: '2026-04-10T09:15:00Z' },
  { _id: 'u5', username: 'sofia.herrera', email: 'sofia@scidist.io', createdAt: '2026-05-01T11:45:00Z' },
  { _id: 'u6', username: 'jorge.vargas', email: 'jorge@scidist.io', createdAt: '2026-05-03T16:00:00Z' },
];

export const MOCK_NODES = [
  { id: 'node-1', name: 'Storage-Fedora-01', ip: '100.119.151.81', status: 'online', load: '12%', role: 'primary' },
  { id: 'node-2', name: 'Storage-Win-02', ip: '100.103.43.31', status: 'online', load: '45%', role: 'replica' },
  { id: 'node-3', name: 'Storage-Win-03', ip: '100.74.105.61', status: 'offline', load: '0%', role: 'replica' }
];

export const formatAdminDate = (date) => new Date(date).toLocaleDateString('es-MX', {
  year: 'numeric', month: 'short', day: 'numeric'
});