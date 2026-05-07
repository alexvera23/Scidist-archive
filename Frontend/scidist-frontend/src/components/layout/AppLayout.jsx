import React, { useState, useEffect } from 'react';
import { Navbar, Container, Form, InputGroup, Offcanvas, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosConfig'; // Tu configuración de axios a Tailscale
import '../../assets/css/app-styles.css'; 
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { getIconForCategory } from '../../utils/helpers';




export default function AppLayout({ children, onSelectCategory, categoryCounts = {} }) {
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeCategory, setActiveCategory] = useState('todos');
  const [openAccordions, setOpenAccordions] = useState({});
  
  // Nuevos estados para los datos reales
  const [userCategories, setUserCategories] = useState([]);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Cargar usuario y sus categorías al montar el componente
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    
    if (!storedUser) {
      // Si no hay sesión, regresamos al login
      navigate('/');
      return;
    }

    const user = JSON.parse(storedUser);
    setUserData(user);

    const fetchCategories = async () => {
      try {
        const response = await api.get(`/themes/user/${user.id}`);
        // Mapeamos los datos para inyectarles un ícono visual
        const categoriesWithIcons = response.data.map(cat => ({
          ...cat,
          icon: getIconForCategory(cat.name)
        }));
        
        setUserCategories(categoriesWithIcons);
      } catch (error) {
        console.error("Error al cargar categorías:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, [navigate]);

  const handleClose = () => setShowSidebar(false);
  const handleShow = () => setShowSidebar(true);

  const handleCategoryClick = (categoryName) => {
    setActiveCategory(categoryName);
    if (onSelectCategory) onSelectCategory(categoryName);
    handleClose();
  };

  const toggleAccordion = (id) => {
    setOpenAccordions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
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
            <Form className="d-none d-lg-flex" role="search">
              <InputGroup>
                <InputGroup.Text className="bg-transparent border-end-0">
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control type="search" placeholder="Buscar archivos..." className="border-start-0" />
              </InputGroup>
            </Form>
            
            {/* Saludo al usuario activo */}
            {userData && (
              <span className="text-muted d-none d-md-inline ms-3 fw-medium users">
                Hola {userData.username.split(' ')[0]} <i className="bi bi-person-check"></i> 
              </span>
            )}

            <button className="btn btn-logout ms-2" type="button" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right me-1"></i> Salir
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
              {/* Conteo total: sumamos todos los valores del objeto categoryCounts */}
              <span className="badge" id="badge-todos">
                {isLoading ? <Spinner animation="grow" size="sm" /> : (categoryCounts['todos'] || 0)}
              </span>
            </button>

            {/* Renderizado Dinámico de Categorías Reales */}
            {!isLoading && userCategories.map((cat) => (
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
                    <span className="badge">{categoryCounts[cat.name] || 0}</span>
                    <i className={`bi bi-chevron-${openAccordions[cat.id] ? 'down' : 'right'} transition-icon`}></i>
                  </div>
                </button>
                
                {/* Subcategorías Reales */}
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
                        <span className="badge badge-sub">{categoryCounts[sub] || 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

          </div>
        </Offcanvas.Body>
      </Offcanvas>

      <main className="container-fluid py-4 px-md-5 flex-grow-1">
        {children}
      </main>

      <footer className="text-center py-3 mt-auto border-top">
        <div className="footer-logo">Scidist-Archive</div>
        <p className="footer-note mb-0">© 2026 Scidist-Archive — Clasificador Inteligente de Archivos</p>
      </footer>
    </div>
  );
}