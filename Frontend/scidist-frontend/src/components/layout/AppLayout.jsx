import React, { useState } from 'react';
import { Navbar, Container, Form, InputGroup, Offcanvas } from 'react-bootstrap';
import '../../assets/css/app-styles.css'; 
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

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
  const [openAccordions, setOpenAccordions] = useState({});
  

  const handleClose = () => setShowSidebar(false);
  const handleShow = () => setShowSidebar(true);

  const handleCategoryClick = (categoryName) => {
    setActiveCategory(categoryName);
    if (onSelectCategory) onSelectCategory(categoryName);
    handleClose();
  };

  const toggleAccordion = (id) => {
    setOpenAccordions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
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
            <button className="btn btn-logout" type="button">
              <i className="bi bi-box-arrow-right me-2"></i>Log out
            </button>
          </div>
        </Container>
      </Navbar>

      {/* OFFCANVAS (Sidebar) */}
      <Offcanvas show={showSidebar} onHide={handleClose} placement="start" className="custom-sidebar">
        <Offcanvas.Header closeButton className="border-bottom">
          <Offcanvas.Title className="sidebar-label">CLASIFICACIÓN</Offcanvas.Title>
        </Offcanvas.Header>
        
        <Offcanvas.Body className="p-0">
          <div className="sidebar-nav">
            
            {/* Opción 'Todos' */}
            <button 
              className={`sidebar-item ${activeCategory === 'todos' ? 'active' : ''}`}
              onClick={() => handleCategoryClick('todos')}
            >
              <span><i className="bi bi-grid-3x3 me-3"></i> Todos los archivos</span>
              <span className="badge" id="badge-todos">28</span>
            </button>

            {/* Categorías personalizadas */}
            {USER_CATEGORIES.map((cat) => (
              <div key={cat.id} className="category-group">
                <button 
                  className={`sidebar-item category-header ${activeCategory === cat.name ? 'active' : ''}`}
                  onClick={() => toggleAccordion(cat.id)}
                >
                  <span>
                    <i className={`bi ${cat.icon} me-3`}></i> 
                    {cat.name}
                  </span>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge">{cat.count}</span>
                    <i className={`bi bi-chevron-${openAccordions[cat.id] ? 'down' : 'right'} transition-icon`}></i>
                  </div>
                </button>
                
                {/* Subcategorías */}
                {openAccordions[cat.id] && (
                  <div className="subcategories">
                    {cat.subthemes.map(sub => (
                      <button 
                        key={sub}
                        className={`sidebar-item sub-item ${activeCategory === sub ? 'active' : ''}`}
                        onClick={() => handleCategoryClick(sub)}
                      >
                        <span>
                          <i className="bi bi-arrow-return-right me-3 opacity-50"></i>
                          {sub}
                        </span>
                        <span className="badge badge-sub">0</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

          </div>
        </Offcanvas.Body>
      </Offcanvas>

      {/* CONTENIDO PRINCIPAL */}
      <main className="container-fluid py-4 px-md-5 flex-grow-1">
        {children}
      </main>

      {/* FOOTER */}
      <footer className="text-center py-3 mt-auto border-top">
        <div className="footer-logo">Scidist-Archive</div>
        <p className="footer-note mb-0">© 2026 Scidist-Archive — Clasificador Inteligente de Archivos</p>
      </footer>
    </div>
  );
}