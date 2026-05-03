import React, { useState } from 'react';
import { Navbar, Container, Form, InputGroup, Offcanvas, Accordion, Badge } from 'react-bootstrap';
// Asume que copiaste tus estilos originales aquí
import '../../assets/css/app-styles.css'; 

// Datos de prueba (Estos vendrían del backend después del Login)
const USER_CATEGORIES = [
  { id: 'ia', name: 'Inteligencia Artificial', icon: 'bi-robot', subthemes: ['Machine Learning', 'Deep Learning', 'NLP'], count: 12 },
  { id: 'redes', name: 'Redes', icon: 'bi-hdd-network', subthemes: ['Protocolos', 'Topologías', 'Seguridad'], count: 5 },
  { id: 'dev', name: 'Desarrollo', icon: 'bi-code-slash', subthemes: ['Frontend', 'Backend', 'Arquitectura'], count: 8 },
  { id: 'linux', name: 'Linux', icon: 'bi-ubuntu', subthemes: ['Arch Linux', 'Ubuntu', 'Fedora'], count: 3 }
];

export default function AppLayout({ children, onSelectCategory }) {
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeCategory, setActiveCategory] = useState('todos');

  const handleClose = () => setShowSidebar(false);
  const handleShow = () => setShowSidebar(true);

  const handleCategoryClick = (categoryName) => {
    setActiveCategory(categoryName);
    onSelectCategory(categoryName);
    handleClose(); // Opcional: Cerrar menú en móvil tras seleccionar
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* NAVBAR */}
      <Navbar expand="md" sticky="top" className="custom-navbar shadow-sm">
        <Container fluid className="px-4">
          <div className="d-flex align-items-center">
            <button className="btn btn-menu me-3" type="button" onClick={handleShow}>
              <i className="bi bi-list fs-3"></i>
            </button>
            <Navbar.Brand href="#" className="brand-logo m-0">
              Scidist<span className="accent">-Archive</span>
            </Navbar.Brand>
          </div>

          <div className="d-flex align-items-center gap-3">
            <Form className="d-none d-md-flex" role="search">
              <InputGroup>
                <InputGroup.Text className="bg-transparent border-end-0">
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control type="search" placeholder="Buscar archivos..." className="border-start-0" />
              </InputGroup>
            </Form>
            <button className="btn btn-logout" type="button">Log out</button>
          </div>
        </Container>
      </Navbar>

      {/* OFFCANVAS (Sidebar) */}
      <Offcanvas show={showSidebar} onHide={handleClose} placement="start" className="custom-sidebar">
        <Offcanvas.Header closeButton className="border-bottom">
          <Offcanvas.Title className="sidebar-label" id="sidebarLabel">// Clasificación</Offcanvas.Title>
        </Offcanvas.Header>
        
        <Offcanvas.Body className="p-0">
          <div className="sidebar-section py-3">
            
            {/* Opción 'Todos' */}
            <button 
              className={`sidebar-item ${activeCategory === 'todos' ? 'active' : ''} w-100 text-start border-0`}
              onClick={() => handleCategoryClick('todos')}
            >
              <span className="sidebar-left"><i className="bi bi-grid-1x2 me-2"></i> Todos</span>
              <span className="badge" id="badge-todos">28</span>
            </button>

            {/* Accordion para Categorías y Subcategorías */}
            <Accordion flush className="mt-2">
              {USER_CATEGORIES.map((cat, index) => (
                <Accordion.Item eventKey={index.toString()} key={cat.id} className="bg-transparent border-0">
                  <Accordion.Header className="custom-accordion-header">
                    <span className="sidebar-left"><i className={`bi ${cat.icon} me-2`}></i> {cat.name}</span>
                    <Badge bg="secondary" className="ms-auto me-3 rounded-pill">{cat.count}</Badge>
                  </Accordion.Header>
                  <Accordion.Body className="p-0 bg-dark bg-opacity-10">
                    <div className="d-flex flex-column">
                      {cat.subthemes.map(sub => (
                        <button 
                          key={sub}
                          className={`sidebar-item sub-item ${activeCategory === sub ? 'active' : ''} w-100 text-start border-0 ps-5 py-2`}
                          style={{ fontSize: '0.9rem', backgroundColor: 'transparent' }}
                          onClick={() => handleCategoryClick(sub)}
                        >
                          <i className="bi bi-arrow-return-right me-2 opacity-50"></i> {sub}
                        </button>
                      ))}
                    </div>
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>

          </div>
        </Offcanvas.Body>
      </Offcanvas>

      {/* CONTENIDO PRINCIPAL */}
      <main className="container-fluid py-4 px-md-5 flex-grow-1">
        {children}
      </main>

      {/* FOOTER */}
      <footer className="text-center py-3 mt-auto border-top">
        <div className="footer-logo" style={{ fontFamily: "'Bebas Neue', cursive", fontSize: '1.2rem' }}>Scidist-Archive</div>
        <p className="footer-note mb-0 text-muted" style={{ fontSize: '0.85rem' }}>© 2026 Scidist-Archive — Clasificador Inteligente de Archivos</p>
      </footer>
    </div>
  );
}