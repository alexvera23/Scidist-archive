import React, { useState, useEffect } from 'react';
import { Dropdown, Form, Spinner } from 'react-bootstrap';
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

  // Estados para categorías dinámicas desde el backend
  const [availableCategories, setAvailableCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Obtener catálogo de categorías al montar el componente
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/categories/available');
        setAvailableCategories(response.data);
      } catch (error) {
        console.error('Error obteniendo categorías del servidor:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  // Handlers genéricos
  const handleLoginChange = (e) =>
    setLoginData({ ...loginData, [e.target.name]: e.target.value });

  const handleRegChange = (e) =>
    setRegData({ ...regData, [e.target.name]: e.target.value });

  // Manejo de selección de sub‑temas
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

  // Envío del formulario de login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', loginData);
      if (response.status === 200) {
        // Guardar token o sesión (según tu backend)
        localStorage.setItem('token', response.data.token);
        // Redirigir al dashboard
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error en login:', error);
      alert('Credenciales incorrectas o servidor no disponible.');
    }
  };

  // Envío del formulario de registro
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
        alert('¡Cuenta creada exitosamente! Tu archivo ya está preparado.');
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
      alert('Hubo un problema al crear la cuenta. Verifica que el servidor esté encendido.');
    }
  };

  return (
    <div className="login-container">
      {/* PANEL IZQUIERDO (Branding) */}
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

      {/* PANEL DERECHO (Formularios) */}
      <div className="right-panel">
        {/* PESTAÑAS */}
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

        {/* ========= FORMULARIO DE LOGIN ========= */}
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

            <button type="submit" className="btn-submit">
              Ingresar
            </button>

            <div className="divider">o</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center' }}>
              ¿No tienes cuenta?{' '}
              <a
                href="#register"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('register');
                }}
                style={{ color: 'var(--ink)', fontWeight: '500' }}
              >
                Regístrate gratis
              </a>
            </p>
          </form>
        )}

        {/* ========= FORMULARIO DE REGISTRO ========= */}
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

            {/* DROPDOWN DINÁMICO DE CATEGORÍAS */}
            <div className="field-group mb-4">
              <label>Elige tus intereses principales</label>
              <Dropdown autoClose="outside" className="w-100">
                <Dropdown.Toggle
                  variant="light"
                  className="w-100 text-start d-flex justify-content-between align-items-center"
                  style={{ border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b' }}
                >
                  Seleccionar Categorías...
                </Dropdown.Toggle>

                <Dropdown.Menu
                  className="w-100 p-3 shadow-sm"
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
                >
                  {isLoadingCategories ? (
                    <div className="text-center py-3">
                      <Spinner animation="border" variant="primary" size="sm" />
                      <span className="ms-2 text-muted">Cargando catálogo...</span>
                    </div>
                  ) : (
                    availableCategories.map((cat) => (
                      <div key={cat.id} className="mb-3">
                        <h6 className="dropdown-header px-0 text-dark fw-bold border-bottom pb-1 mb-2">
                          {cat.name}
                        </h6>
                        {cat.subthemes.map((sub) => (
                          <Form.Check
                            key={sub}
                            type="checkbox"
                            id={`check-${cat.id}-${sub}`}
                            label={sub}
                            onChange={() => handleToggleSubtheme(cat.name, sub)}
                            checked={selectedTopics[cat.name]?.includes(sub) || false}
                            className="ms-2 custom-checkbox"
                          />
                        ))}
                      </div>
                    ))
                  )}
                </Dropdown.Menu>
              </Dropdown>
              <p className="field-msg" style={{ color: 'var(--primary-color)' }}>
                {Object.keys(selectedTopics).length} temas seleccionados.
              </p>
            </div>

            <div className="checkbox-field">
              <input type="checkbox" id="acceptTerms" required />
              <label htmlFor="acceptTerms">
                Acepto los <a href="#terms">Términos</a> y <a href="#privacy">Privacidad</a>
              </label>
            </div>

            <button type="submit" className="btn-submit">
              Crear Cuenta
            </button>

            <div className="divider">o</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center' }}>
              ¿Ya tienes cuenta?{' '}
              <a
                href="#login"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('login');
                }}
                style={{ color: 'var(--ink)', fontWeight: '500' }}
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