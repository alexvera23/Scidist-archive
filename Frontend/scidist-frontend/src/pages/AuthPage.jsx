import React, { useState, useEffect, useRef } from 'react';
import { Spinner } from 'react-bootstrap';
import api from '../api/axiosConfig';
import { useNavigate } from 'react-router-dom';
import '../assets/css/login-styles.css';

export default function AuthPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('login');

  // Estados de formularios
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [regData, setRegData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [selectedTopics, setSelectedTopics] = useState({});

  // Estados para categorías dinámicas
  const [availableCategories, setAvailableCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Estado para el dropdown personalizado
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Obtener catálogo de categorías
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/categories/available');
        setAvailableCategories(response.data);
      } catch (error) {
        console.error('Error obteniendo categorías:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  const handleLoginChange = (e) =>
    setLoginData({ ...loginData, [e.target.name]: e.target.value });

  const handleRegChange = (e) =>
    setRegData({ ...regData, [e.target.name]: e.target.value });

  const handleToggleSubtheme = (themeName, subtheme) => {
    setSelectedTopics((prev) => {
      const currentSubthemes = prev[themeName] || [];
      const hasSubtheme = currentSubthemes.includes(subtheme);
      const updatedSubthemes = hasSubtheme
        ? currentSubthemes.filter((s) => s !== subtheme)
        : [...currentSubthemes, subtheme];

      if (updatedSubthemes.length === 0) {
        const newState = { ...prev };
        delete newState[themeName];
        return newState;
      }
      return { ...prev, [themeName]: updatedSubthemes };
    });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', loginData);
      if (response.status === 200) {
        localStorage.setItem('token', response.data.token);
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error en login:', error);
      alert('Credenciales incorrectas o servidor no disponible.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (regData.password !== regData.confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }
    const payload = {
      username: `${regData.firstName} ${regData.lastName}`,
      email: regData.email,
      password: regData.password,
      preferences: selectedTopics,
    };
    try {
      const response = await api.post('/auth/register', payload);
      if (response.status === 201) {
        alert('¡Cuenta creada exitosamente!');
        setActiveTab('login');
        setRegData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: '',
        });
        setSelectedTopics({});
      }
    } catch (error) {
      console.error('Error en registro:', error);
      alert('Hubo un problema al crear la cuenta.');
    }
  };

  // Contador de temas seleccionados
  const totalSelected = Object.keys(selectedTopics).reduce(
    (acc, key) => acc + selectedTopics[key].length,
    0
  );

  return (
    <div className="login-container">
      {/* PANEL IZQUIERDO */}
      <div className="left-panel">
        <a href="/" className="panel-logo">
          Scidist<span>-Archive</span>
        </a>
        <div className="panel-content">
          <h2>
            Tu Archivo.<br />
            <em>Tu Orden.</em>
          </h2>
          <p>
            Gestiona y clasifica todos tus archivos digitales desde un solo lugar,
            de forma inteligente y segura.
          </p>
        </div>
        <div className="panel-features">
          <div className="panel-feature">
            <i className="bi bi-box-seam feat-icon"></i> Soporte para +50 archivos
          </div>
          <div className="panel-feature">
            <i className="bi bi-lightning-charge feat-icon"></i> Clasificación automática por áreas
          </div>
          <div className="panel-feature">
            <i className="bi bi-shield-lock feat-icon"></i> Datos seguros y privados
          </div>
          <div className="panel-feature">
            <i className="bi bi-graph-up-arrow feat-icon"></i> Estadísticas en tiempo real
          </div>
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="right-panel">
        <div className="form-tabs">
          <button
            className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
            type="button"
          >
            Iniciar Sesión
          </button>
          <button
            className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
            type="button"
          >
            Crear Cuenta
          </button>
        </div>

        {/* LOGIN */}
        {activeTab === 'login' && (
          <form className="form-panel active" onSubmit={handleLoginSubmit}>
            <h3 className="form-title">Bienvenido de Vuelta</h3>
            <p className="form-subtitle">Ingresa tus credenciales para continuar</p>
            <div className="field-group">
              <label>Correo Electrónico</label>
              <input
                type="email"
                name="email"
                placeholder="tucorreo@ejemplo.com"
                value={loginData.email}
                onChange={handleLoginChange}
                required
              />
            </div>
            <div className="field-group">
              <label>Contraseña</label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={loginData.password}
                onChange={handleLoginChange}
                required
              />
            </div>
            <div className="checkbox-field">
              <input type="checkbox" id="rememberMe" />
              <label htmlFor="rememberMe">Recordar mi sesión en este dispositivo</label>
            </div>
            <button type="submit" className="btn-submit">Ingresar</button>
            <div className="divider">o</div>
            <p className="switch-prompt">
              ¿No tienes cuenta?{' '}
              <a
                href="#register"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('register');
                }}
              >
                Regístrate gratis
              </a>
            </p>
          </form>
        )}

        {/* REGISTRO */}
        {activeTab === 'register' && (
          <form className="form-panel active" onSubmit={handleRegisterSubmit}>
            <h3 className="form-title">Crear Cuenta</h3>
            <p className="form-subtitle">Es gratis y solo toma un momento</p>

            <div className="field-row">
              <div className="field-group">
                <label>Nombre</label>
                <input
                  type="text"
                  name="firstName"
                  placeholder="Alex"
                  value={regData.firstName}
                  onChange={handleRegChange}
                  required
                />
              </div>
              <div className="field-group">
                <label>Apellido</label>
                <input
                  type="text"
                  name="lastName"
                  placeholder="Vera"
                  value={regData.lastName}
                  onChange={handleRegChange}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label>Correo Electrónico</label>
              <input
                type="email"
                name="email"
                placeholder="tucorreo@ejemplo.com"
                value={regData.email}
                onChange={handleRegChange}
                required
              />
            </div>

            <div className="field-group">
              <label>Contraseña</label>
              <input
                type="password"
                name="password"
                placeholder="Mínimo 8 caracteres"
                value={regData.password}
                onChange={handleRegChange}
                required
              />
            </div>

            <div className="field-group">
              <label>Confirmar Contraseña</label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Repite tu contraseña"
                value={regData.confirmPassword}
                onChange={handleRegChange}
                required
              />
            </div>

            {/* DROPDOWN PERSONALIZADO */}
            <div className="field-group custom-dropdown-group" ref={dropdownRef}>
              <label>Elige tus intereses principales</label>
              <div
                className={`custom-dropdown-toggle ${dropdownOpen ? 'open' : ''}`}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className="dropdown-text">
                  {totalSelected === 0
                    ? 'Seleccionar categorías...'
                    : `${totalSelected} tema${totalSelected !== 1 ? 's' : ''} seleccionado${totalSelected !== 1 ? 's' : ''}`}
                </span>
                <i className={`bi bi-chevron-${dropdownOpen ? 'up' : 'down'}`}></i>
              </div>

              {dropdownOpen && (
                <div className="custom-dropdown-menu">
                  {isLoadingCategories ? (
                    <div className="text-center py-3">
                      <Spinner animation="border" variant="primary" size="sm" />
                      <span className="ms-2 text-muted">Cargando catálogo...</span>
                    </div>
                  ) : (
                    availableCategories.map((cat) => (
                      <div key={cat.id} className="dropdown-category">
                        <div className="dropdown-category-title">{cat.name}</div>
                        <div className="dropdown-subthemes">
                          {cat.subthemes.map((sub) => (
                            <label key={sub} className="custom-checkbox-label">
                              <input
                                type="checkbox"
                                checked={selectedTopics[cat.name]?.includes(sub) || false}
                                onChange={() => handleToggleSubtheme(cat.name, sub)}
                              />
                              <span>{sub}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              <div className="field-msg ">
                {totalSelected} tema{totalSelected !== 1 ? 's' : ''} seleccionado{totalSelected !== 1 ? 's' : ''}.
              </div>
            </div>

            <div className="checkbox-field">
              <input type="checkbox" id="acceptTerms" required />
              <label htmlFor="acceptTerms">
                Acepto los <a href="#terms">Términos</a> y <a href="#privacy">Privacidad</a>
              </label>
            </div>

            <button type="submit" className="btn-submit">Crear Cuenta</button>
            <div className="divider">o</div>
            <p className="switch-prompt">
              ¿Ya tienes cuenta?{' '}
              <a
                href="#login"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('login');
                }}
              >
                Inicia sesión
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}