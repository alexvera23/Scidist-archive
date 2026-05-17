const express = require('express');
const mongoose = require('mongoose');
const dgram = require('dgram');
const cors = require('cors'); // <-- NUEVO: Vital para redes distribuidas
require('dotenv').config();

const { User, Theme, Subtheme, Article, StorageMap, NodeHealth, ReplicationTask, ActiveNode } = require('./models');

// Simulación de catálogo en base de datos (Más adelante puede ser una colección en Mongo)
const CATALOGO_CATEGORIAS = [
  { id: 'redes', name: 'Redes', subthemes: ['Protocolos', 'Topologías', 'Seguridad'] },
  { id: 'ia', name: 'Inteligencia Artificial', subthemes: ['Machine Learning', 'Deep Learning', 'NLP'] },
  { id: 'dev', name: 'Desarrollo de Software', subthemes: ['Frontend', 'Backend', 'Arquitectura'] },
  { id: 'linux', name: 'Linux', subthemes: ['Arch Linux', 'Ubuntu', 'Fedora'] },
  { id: 'General', name: 'General', subthemes: ['General']}
];

const app = express();
app.use(cors()); // <-- NUEVO: Permitir peticiones de otras IPs
app.use(express.json());

// Obligamos al sistema a usar la variable de entorno real
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error(' ERROR FATAL: MONGO_URI no está definida. Revisa tu archivo .env');
  process.exit(1); // Detenemos el contenedor si no sabe a dónde conectarse
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log(' Conectado al Replica Set de MongoDB distribuido');
    try {
      await User.createCollection();
      await Theme.createCollection();
      await Subtheme.createCollection();
      await Article.createCollection();
      await StorageMap.createCollection();
      await ReplicationTask.createCollection();
      await NodeHealth.createCollection();
      await ActiveNode.createCollection();
      console.log(' Colecciones Multi-Tenant inicializadas');
    } catch (err) {
      if (err.code !== 48) console.error('Error creando colecciones:', err);
    }
  })
  .catch(err => console.error(' Error de conexión Mongo:', err.message));


//  RUTA DE PRUEBA: Generar Usuario y Temas

app.post('/api/v1/setup-test-user', async (req, res) => {
  try {
    // 1. Crear usuario de prueba
    const testUser = new User({
      username: `cientifico_${Date.now()}`, // Nombre único
      email: `test_${Date.now()}@scidist.com`,
      password: 'hashed_password_placeholder'
    });
    await testUser.save();

    // 2. Crear Temas (General y Redes)
    const themeGeneral = new Theme({ name: 'General', owner_id: testUser._id });
    const themeRedes = new Theme({ name: 'Redes', owner_id: testUser._id });
    await themeGeneral.save();
    await themeRedes.save();

    // 3. Crear Subtemas (Protocolos y Topologías, pertenecientes a Redes)
    const subProtocolos = new Subtheme({ name: 'Protocolos', parent_theme_id: themeRedes._id, owner_id: testUser._id });
    const subTopologias = new Subtheme({ name: 'Topologias', parent_theme_id: themeRedes._id, owner_id: testUser._id });
    await subProtocolos.save();
    await subTopologias.save();

    console.log(`[Setup] Usuario de prueba creado: ${testUser._id}`);
    res.status(201).json({
      message: 'Entorno de prueba creado',
      user_id: testUser._id,
      themes: {
        general_id: themeGeneral._id,
        redes_id: themeRedes._id
      },
      subthemes: {
        protocolos_id: subProtocolos._id,
        topologias_id: subTopologias._id
      }
    });

  } catch (error) {
    console.error('Error en setup:', error);
    console.error(error);
    res.status(500).json({ error: 'Fallo al crear entorno de prueba',details: error.message });
  }
});


//  SERVIDOR UDP (HEARTBEATS)

const udpServer = dgram.createSocket('udp4');

udpServer.on('message', async (msg, rinfo) => {
  try {
    const data = JSON.parse(msg);
    if (data.node_id) {
      await NodeHealth.findOneAndUpdate(
        { node_id: data.node_id },
        { status: 'up', last_heartbeat: new Date(data.timestamp) },
        { upsert: true, new: true }
      );
    }
  } catch (e) {}
});

udpServer.on('error', (err) => console.error(` [UDP] Error crítico: ${err.message}`));
udpServer.bind(3002, '0.0.0.0', () => console.log(' Servidor UDP escuchando en 0.0.0.0:3002'));

setInterval(async () => {
  try {
    const threshold = new Date(Date.now() - 15000);
    await NodeHealth.updateMany(
      { last_heartbeat: { $lt: threshold }, status: 'up' },
      { $set: { status: 'down' } }
    );
  } catch (e) {}
}, 10000);


// ENDPOINTS HTTP (ACTUALIZADOS CON OWNER_ID)


// Consulta Inteligente para Descarga (Ahora requiere saber QUIÉN es el dueño)
app.get('/api/v1/articles/:hash', async (req, res) => {
  try {
    const file_hash = req.params.hash;
    const { owner_id } = req.query; // Nuevo: El gateway nos pasará quién lo pide

    if (!owner_id) return res.status(400).json({ error: 'Falta owner_id' });

    // Filtrar para que solo encuentre el artículo si le pertenece a este usuario
    const article = await Article.findOne({ file_hash, owner_id });
    
    if (!article) return res.status(404).json({ error: 'No encontrado o no tienes permisos' });

    const storages = await StorageMap.find({ file_hash, status: 'synced' });
    if (storages.length === 0) return res.status(404).json({ error: 'Físicamente no encontrado' });

    const activeNodes = await NodeHealth.find({ status: 'up' }).select('node_id');
    const activeNodeIds = activeNodes.map(n => n.node_id);
    const availableStorages = storages.filter(s => activeNodeIds.includes(s.node_id));

    if (availableStorages.length === 0) return res.status(503).json({ error: 'Nodos fuera de línea' });

    const chosenNode = availableStorages.find(s => s.is_primary) || availableStorages[0];
    res.status(200).json({ title: article.title, node_id: chosenNode.node_id, is_replica: !chosenNode.is_primary });
  } catch (error) {
    res.status(500).json({ error: 'Error BD' });
  }
});

// NUEVO: Obtener todas las categorías de un usuario
app.get('/api/v1/users/:id/categories', async (req, res) => {
  try {
    const owner_id = req.params.id;
    const themes = await Theme.find({ owner_id });
    const subthemes = await Subtheme.find({ owner_id });
    res.json({ themes, subthemes });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo categorías' });
  }
});

// Guardar Metadatos del Artículo (Actualizado con Temas)
app.post('/api/v1/articles', async (req, res) => {
  // Ahora esperamos el owner_id y los temas desde el Gateway
  const { file_hash, title, owner_id, theme_id, subtheme_id, node_id, replicas } = req.body; 

  if (!file_hash || !title || !owner_id || !node_id) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const newArticle = new Article({ 
      file_hash, 
      title, 
      owner_id, 
      theme_id, 
      subtheme_id, 
      status: 'available' 
    });
    await newArticle.save({ session });

    const newStorageMap = new StorageMap({ file_hash, node_id, is_primary: true, status: 'synced' });
    await newStorageMap.save({ session });

    if (replicas && replicas.length > 0) {
      const tasks = replicas.map(replica_id => ({
        file_hash, source_node: node_id, target_node: replica_id, status: 'pending'
      }));
      await ReplicationTask.insertMany(tasks, { session });
    }

    await session.commitTransaction();
    session.endSession();
    res.status(201).json({ message: 'Registrado con éxito', article_id: newArticle._id });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: 'Error en transacción' });
  }
});

// Obtener tareas pendientes del nodo (Actualizado para REPLICATE y DELETE)
app.get('/api/v1/replication-tasks/:node_id', async (req, res) => {
  try {
    const nodeId = req.params.node_id;
    const tasks = await ReplicationTask.find({
      status: 'pending',
      $or: [
        { source_node: nodeId, task_type: { $ne: 'DELETE' } }, // Replicación normal
        { target_node: nodeId, task_type: 'DELETE' }           // Órdenes de ejecución (Borrado)
      ]
    }).limit(5);
    res.json(tasks);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

// Completar tarea (Actualizado para limpiar StorageMap al borrar)
app.post('/api/v1/replication-tasks/complete', async (req, res) => {
  const { task_id, file_hash, target_node, task_type } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    await ReplicationTask.findByIdAndUpdate(task_id, { status: 'done' }, { session });

    if (task_type === 'DELETE') {
      // Si fue un borrado, quitamos este nodo del mapa de almacenamiento
      await StorageMap.findOneAndDelete({ file_hash, node_id: target_node }, { session });
    } else {
      // Si fue replicación, lo agregamos al mapa
      const newMap = new StorageMap({ file_hash, node_id: target_node, is_primary: false, status: 'synced' });
      await newMap.save({ session });
    }

    await session.commitTransaction();
    res.json({ message: 'OK' });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: 'Error' });
  } finally {
    session.endSession();
  }
});

// 1. Registro de Nodo (Llamado por los Storage Nodes al arrancar)
app.post('/api/v1/nodes/register', async (req, res) => {
  const { node_id, address } = req.body;
  try {
    await ActiveNode.findOneAndUpdate(
      { node_id },
      { address, last_seen: new Date() },
      { upsert: true }
    );
    console.log(`[Registry] Nodo registrado: ${node_id} en ${address}`);
    res.status(200).json({ message: 'Registrado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar nodo' });
  }
});

// 2. Listar Nodos (Llamado por el Gateway y por otros nodos para replicación)
app.get('/api/v1/nodes', async (req, res) => {
  try {
    // 1. Consultar NodeHealth para saber quiénes están realmente vivos ("up")
    const healthyNodes = await NodeHealth.find({ status: 'up' }).select('node_id');
    const healthyIds = healthyNodes.map(n => n.node_id);

    // 2. Buscar en ActiveNode solo los nodos que coincidan con esos IDs vivos
    const nodes = await ActiveNode.find({ node_id: { $in: healthyIds } });
    
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener nodos activos' });
  }
});

// ==========================================
// NUEVO: BORRADO DISTRIBUIDO (REFERENCE COUNTING)
// ==========================================
app.delete('/api/v1/articles/:hash', async (req, res) => {
  const file_hash = req.params.hash;
  const { owner_id } = req.query;

  if (!owner_id) return res.status(400).json({ error: 'Falta owner_id' });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Borrado Lógico: Verificamos propiedad y borramos el registro del usuario
    const deletedArticle = await Article.findOneAndDelete({ file_hash, owner_id }, { session });
    
    if (!deletedArticle) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Archivo no encontrado o no eres el propietario' });
    }

    // 2. Conteo de Referencias (Deduplicación)
    const remainingOwners = await Article.countDocuments({ file_hash }, { session });

    if (remainingOwners > 0) {
      // Caso A: Alguien más tiene el archivo. Terminamos aquí.
      await session.commitTransaction();
      return res.status(200).json({ 
        message: 'Borrado lógico exitoso. El archivo físico se mantiene porque otros usuarios lo comparten.' 
      });
    }

    // 3. Caso B: Eres el último dueño. Iniciamos el Hard Delete Distribuido.
    const storages = await StorageMap.find({ file_hash }, null, { session });
    
    if (storages.length > 0) {
      const deleteTasks = storages.map(s => ({
        file_hash: file_hash,
        source_node: 'SYSTEM',
        target_node: s.node_id,
        task_type: 'DELETE',
        status: 'pending'
      }));
      await ReplicationTask.insertMany(deleteTasks, { session });
    }

    await session.commitTransaction();
    res.status(200).json({ message: 'Borrado físico distribuido iniciado. Eras el último propietario.' });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error en borrado:', error);
    res.status(500).json({ error: 'Error interno procesando el borrado' });
  } finally {
    session.endSession();
  }
});

// 1. Endpoint para obtener las categorías disponibles
app.get('/api/v1/categories/available', (req, res) => {
  res.json(CATALOGO_CATEGORIAS);
});

// 2. Endpoint de Registro
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { username, email, password, preferences } = req.body;

    // 1. Guardar el usuario principal
    const newUser = new User({ username, email, password });
    await newUser.save();

    // 2. creando la categoria General por defecto
     const generalTheme = new Theme({ 
      name: 'General', 
      owner_id: newUser._id 
    });
    await generalTheme.save();

    // Crear su subcategoría "Otros" interna
    const generalOthers = new Subtheme({
      name: 'Otros',
      parent_theme_id: generalTheme._id,
      owner_id: newUser._id
    });
    await generalOthers.save();

    // 3. Crear las categorías y subcategorías elegidas en el registro
    // preferences tiene este formato: { "Redes": ["Protocolos", "Seguridad"], "Linux": ["Fedora"] }
    for (const [themeName, subthemes] of Object.entries(preferences)) {
      // Evitamos duplicar si el usuario de alguna forma intentó crear "General"
      if (themeName.toLowerCase() === 'general') continue;

      const theme = new Theme({ name: themeName, owner_id: newUser._id });
      await theme.save();

      // 1. Crear subcategoría "Otros" por defecto para CADA categoría elegida
      const defaultSub = new Subtheme({
        name: 'Otros',
        parent_theme_id: theme._id,
        owner_id: newUser._id
      });
      await defaultSub.save();

      // 2. Crear las subcategorías específicas que eligió el usuario
      for (const subName of subthemes) {
        // Evitamos crear "Otros" dos veces si ya estaba en su lista
        if (subName.toLowerCase() === 'otros') continue;

        const subtheme = new Subtheme({ 
          name: subName, 
          parent_theme_id: theme._id, 
          owner_id: newUser._id 
        });
        await subtheme.save();
      }
    }

    res.status(201).json({ message: "Usuario y estructura de carpetas creada: ", userId: newUser._id });
  } catch (error) {
    res.status(500).json({ error: "Error en el registro: " + error.message });
  }
});


//Endpoint para el inicio de sesion 
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Buscar usuario por email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // 2. Validar contraseña (Comparación simple por ahora)
    if (user.password !== password) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // 3. Responder con datos básicos del usuario
    console.log(` Sesión iniciada: ${user.username} (Admin: ${user.is_admin || false})`);
    res.json({
      message: "Login exitoso",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin || false 
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor durante el login" });
  }
});

// GET: Obtener el árbol de categorías de un usuario
app.get('/api/v1/themes/user/:owner_id', async (req, res) => {
  try {
    const { owner_id } = req.params;
    
    // 1. Buscamos todos los temas y subtemas del usuario
    const themes = await Theme.find({ owner_id }).lean();
    const subthemes = await Subtheme.find({ owner_id }).lean();

    // 2. Construimos la estructura anidada para React
    const structuredData = themes.map(theme => {
      // Filtramos los subtemas que pertenecen a este tema específico
      const relatedSubthemes = subthemes
        .filter(sub => sub.parent_theme_id.toString() === theme._id.toString())
        .map(sub => sub.name);

      return {
        id: theme._id,
        name: theme.name,
        subthemes: relatedSubthemes,
        count: 0 // Aquí luego conectaremos el conteo real de archivos
      };
    });

    res.json(structuredData);
  } catch (error) {
    console.error("Error obteniendo categorías:", error);
    res.status(500).json({ error: "Error al cargar las categorías del usuario" });
  }
});

// GET: Obtener todos los archivos de un usuario

app.get('/api/v1/files/user/:owner_id', async (req, res) => {
  try {
    const { owner_id } = req.params;
    
    // 1. Buscamos usando tu modelo "Article"
    // Filtrar por status: 'available' es una buena práctica para no mostrar archivos borrados o con error
    const articles = await Article.find({ owner_id, status: 'available' })
      .populate('theme_id', 'name')
      .populate('subtheme_id', 'name')
      .lean();

    // 2. Mapeamos exactamente a los campos de tu ArticleSchema
    const formattedFiles = articles.map(article => ({
      id: article._id,
      name: article.title || article.file_hash, // Usamos title, o el hash como respaldo
      size: 0, //  Tu esquema no guarda el tamaño en bytes. Mandamos 0 por defecto para que no falle el frontend.
      date: article.createdAt, // Lo provee el { timestamps: true } de tu esquema
      category: article.theme_id?.name || 'General',
      subcategory: article.subtheme_id?.name || 'Otros',
      hash: article.file_hash // Agregamos el hash porque lo necesitarás para la descarga
    }));

    res.json(formattedFiles);
  } catch (error) {
    console.error("Error obteniendo archivos:", error);
    res.status(500).json({ error: "Error al cargar los archivos del usuario" });
  }
});

// ==========================================
//    ENDPOINTS DE ADMINISTRACIÓN (BACKEND)
// ==========================================

// 0. Verificar si un usuario es administrador
app.get('/api/v1/admin/check/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    // Devolvemos el estado de admin (si no existe el campo, por defecto es false)
    res.json({ is_admin: user.is_admin || false });
  } catch (error) {
    res.status(500).json({ error: "Error al verificar permisos" });
  }
});

// 1. Obtener lista de todos los usuarios (excluyendo la contraseña)
app.get('/api/v1/admin/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 }).lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// 2. Eliminar un usuario en cascada (limpiando sus temas y subtemas)
app.delete('/api/v1/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    await Theme.deleteMany({ owner_id: id });
    await Subtheme.deleteMany({ owner_id: id });
    // Nota: Las réplicas y archivos físicos podrían quedarse o manejarse con un "soft delete"
    res.json({ message: "Usuario y estructura de carpetas eliminados correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

// 3. Obtener salud y lista de nodos
app.get('/api/v1/admin/nodes', async (req, res) => {
  try {
    const [activeNodes, nodeHealths] = await Promise.all([
      ActiveNode.find().lean(),
      NodeHealth.find().lean(),
    ]);
 
    // Construimos un mapa rápido de salud por node_id
    const healthMap = Object.fromEntries(
      nodeHealths.map((h) => [h.node_id, h])
    );
 
    const now = new Date();
 
    const nodesWithHealth = activeNodes.map((node) => {
      const health    = healthMap[node.node_id];
      const lastBeat  = health
        ? new Date(health.last_heartbeat)
        : new Date(node.last_seen);
      const diffSecs  = (now - lastBeat) / 1000;
      const isUp      = health?.status === 'up' && diffSecs < 30;
 
      return {
        ...node,
        status:          isUp ? 'up' : 'down',
        last_heartbeat:  health?.last_heartbeat || node.last_seen,
        health:          diffSecs < 30 ? 'healthy' : 'unreachable',
        uptime:          isUp ? 'Online' : 'Offline',
      };
    });
 
    res.json(nodesWithHealth);
  } catch (error) {
    console.error('Error al obtener nodos:', error);
    res.status(500).json({ error: 'Error al obtener estado de nodos' });
  }
});

// 4. Inventario global de artículos (Storage Map)
app.get('/api/v1/admin/articles', async (req, res) => {
  try {
    const articles = await Article.find()
      .populate('owner_id', 'username email')
      .populate('theme_id', 'name')
      .populate('subtheme_id', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener inventario" });
  }
});

// 5. Estado de tareas de replicación
app.get('/api/v1/admin/replications', async (req, res) => {
  try {
    const tasks = await ReplicationTask.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener tareas de replicación" });
  }
});

// ── 6. Crear usuario desde el panel admin
app.post('/api/v1/admin/users', async (req, res) => {
  try {
    const { username, email, password } = req.body;
 
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email y password son obligatorios' });
    }
 
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) {
      return res.status(409).json({ error: 'El nombre de usuario o email ya están en uso' });
    }
 
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, email, password: hashedPassword });
 
    // Devolvemos el usuario sin exponer la contraseña
    const { password: _, ...userSafe } = newUser.toObject();
    res.status(201).json(userSafe);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});
 
// ── 7. Actualizar usuario desde el panel admin
app.put('/api/v1/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password } = req.body;
 
    const updatePayload = {};
    if (username) updatePayload.username = username;
    if (email)    updatePayload.email    = email;
    if (password) updatePayload.password = await bcrypt.hash(password, 10);
 
    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }
 
    // Verificamos colisión de username/email con otros usuarios
    if (username || email) {
      const conflict = await User.findOne({
        _id: { $ne: id },
        $or: [
          ...(username ? [{ username }] : []),
          ...(email    ? [{ email }]    : []),
        ],
      });
      if (conflict) {
        return res.status(409).json({ error: 'El nombre de usuario o email ya están en uso' });
      }
    }
 
    const updated = await User.findByIdAndUpdate(id, updatePayload, { new: true })
      .select('-password')
      .lean();
 
    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });
 
    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});
 
// ── 8. Inventario global de Storage Maps
app.get('/api/v1/admin/storage-maps', async (req, res) => {
  try {
    const maps = await StorageMap.find().sort({ file_hash: 1 }).lean();
    res.json(maps);
  } catch (error) {
    console.error('Error al obtener storage maps:', error);
    res.status(500).json({ error: 'Error al obtener mapas de almacenamiento' });
  }
});

// ── 9. Árbol de categorías de un usuario CON IDs de subtemas
//       (versión admin: incluye los _id para poder borrar)
app.get('/api/v1/admin/users/:userId/themes', async (req, res) => {
  try {
    const { userId } = req.params;
 
    const [themes, subthemes] = await Promise.all([
      Theme.find({ owner_id: userId }).lean(),
      Subtheme.find({ owner_id: userId }).lean(),
    ]);
 
    const tree = themes.map((theme) => ({
      id:        theme._id,
      name:      theme.name,
      subthemes: subthemes
        .filter((sub) => sub.parent_theme_id.toString() === theme._id.toString())
        .map((sub) => ({ id: sub._id, name: sub.name })),
    }));
 
    res.json(tree);
  } catch (error) {
    console.error('Error al obtener árbol admin:', error);
    res.status(500).json({ error: 'Error al obtener árbol de categorías' });
  }
});
 
// ── 10. Añadir temas/subtemas a un usuario existente
//        Body: { preferences: { "Redes": ["Protocolos"], "Linux": [] } }
//        Misma lógica que el registro, pero sobre un usuario ya creado
app.post('/api/v1/admin/users/:userId/themes', async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferences } = req.body;
 
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'preferences debe ser un objeto' });
    }
 
    const userExists = await User.findById(userId);
    if (!userExists) return res.status(404).json({ error: 'Usuario no encontrado' });
 
    const results = [];
 
    for (const [themeName, subthemes] of Object.entries(preferences)) {
      if (themeName.toLowerCase() === 'general') continue;
      if (!Array.isArray(subthemes)) continue;
 
      // Reusar tema existente o crear uno nuevo
      let theme = await Theme.findOne({ name: themeName, owner_id: userId });
      if (!theme) {
        theme = await Theme.create({ name: themeName, owner_id: userId });
        // Subtema "Otros" por defecto solo si el tema es nuevo
        await Subtheme.create({ name: 'Otros', parent_theme_id: theme._id, owner_id: userId });
      }
 
      for (const subName of subthemes) {
        if (subName.toLowerCase() === 'otros') continue;
        // Solo crear si no existe ya
        const exists = await Subtheme.findOne({ name: subName, parent_theme_id: theme._id });
        if (!exists) {
          await Subtheme.create({ name: subName, parent_theme_id: theme._id, owner_id: userId });
        }
      }
 
      results.push(themeName);
    }
 
    res.json({ message: 'Categorías añadidas', themes: results });
  } catch (error) {
    console.error('Error al añadir temas:', error);
    res.status(500).json({ error: 'Error al añadir categorías' });
  }
});
 
// ── 11. Eliminar un tema completo (y todos sus subtemas)
//        Los artículos huérfanos se reasignan a General/Otros del usuario
app.delete('/api/v1/admin/themes/:themeId', async (req, res) => {
  try {
    const { themeId } = req.params;
 
    const theme = await Theme.findById(themeId);
    if (!theme) return res.status(404).json({ error: 'Tema no encontrado' });
 
    // Protegemos la categoría "General"
    if (theme.name.toLowerCase() === 'general') {
      return res.status(400).json({ error: 'No se puede eliminar la categoría General' });
    }
 
    // Buscamos General/Otros del mismo usuario para reasignar artículos
    const generalTheme = await Theme.findOne({ name: 'General', owner_id: theme.owner_id });
    const othersSubtheme = generalTheme
      ? await Subtheme.findOne({ name: 'Otros', parent_theme_id: generalTheme._id })
      : null;
 
    if (othersSubtheme) {
      // Reasignar artículos huérfanos
      await Article.updateMany(
        { theme_id: themeId, owner_id: theme.owner_id },
        { theme_id: generalTheme._id, subtheme_id: othersSubtheme._id }
      );
    }
 
    // Borrar subtemas y tema
    await Subtheme.deleteMany({ parent_theme_id: themeId });
    await Theme.findByIdAndDelete(themeId);
 
    res.json({ message: `Tema "${theme.name}" eliminado` });
  } catch (error) {
    console.error('Error al eliminar tema:', error);
    res.status(500).json({ error: 'Error al eliminar tema' });
  }
});
 
// ── 12. Eliminar un subtema individual
//        Los artículos de ese subtema se reasignan a "Otros" del mismo tema
app.delete('/api/v1/admin/subthemes/:subthemeId', async (req, res) => {
  try {
    const { subthemeId } = req.params;
 
    const subtheme = await Subtheme.findById(subthemeId);
    if (!subtheme) return res.status(404).json({ error: 'Subtema no encontrado' });
 
    // Protegemos "Otros" dentro de General
    const parentTheme = await Theme.findById(subtheme.parent_theme_id);
    if (
      parentTheme?.name.toLowerCase() === 'general' &&
      subtheme.name.toLowerCase() === 'otros'
    ) {
      return res.status(400).json({ error: 'No se puede eliminar General/Otros' });
    }
 
    // Reasignar artículos al subtema "Otros" del mismo tema padre
    const othersInParent = await Subtheme.findOne({
      name: 'Otros',
      parent_theme_id: subtheme.parent_theme_id,
    });
 
    if (othersInParent) {
      await Article.updateMany(
        { subtheme_id: subthemeId, owner_id: subtheme.owner_id },
        { subtheme_id: othersInParent._id }
      );
    }
 
    await Subtheme.findByIdAndDelete(subthemeId);
 
    res.json({ message: `Subtema "${subtheme.name}" eliminado` });
  } catch (error) {
    console.error('Error al eliminar subtema:', error);
    res.status(500).json({ error: 'Error al eliminar subtema' });
  }
});

// ==========================================
//    ENDPOINTS DE CATEGORÍAS (USUARIO)
// ==========================================

// 1. Obtener el árbol del usuario logueado
app.get('/api/v1/themes/me', async (req, res) => {
  try {
    const owner_id = req.headers['x-user-id'];
    if (!owner_id) return res.status(401).json({ error: 'Falta cabecera x-user-id' });

    const [themes, subthemes] = await Promise.all([
      Theme.find({ owner_id }).lean(),
      Subtheme.find({ owner_id }).lean(),
    ]);

    const tree = themes.map((theme) => ({
      id: theme._id,
      name: theme.name,
      subthemes: subthemes
        .filter((sub) => sub.parent_theme_id.toString() === theme._id.toString())
        .map((sub) => ({ id: sub._id, name: sub.name })),
    }));
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// 2. Añadir nuevas temáticas/subtemáticas
app.post('/api/v1/themes/me', async (req, res) => {
  try {
    const owner_id = req.headers['x-user-id'];
    const { preferences } = req.body;
    if (!owner_id) return res.status(401).json({ error: 'No autorizado' });

    const results = [];
    for (const [themeName, subthemes] of Object.entries(preferences)) {
      if (themeName.toLowerCase() === 'general') continue;
      
      let theme = await Theme.findOne({ name: themeName, owner_id });
      if (!theme) {
        theme = await Theme.create({ name: themeName, owner_id });
        await Subtheme.create({ name: 'Otros', parent_theme_id: theme._id, owner_id });
      }

      for (const subName of subthemes) {
        if (subName.toLowerCase() === 'otros') continue;
        const exists = await Subtheme.findOne({ name: subName, parent_theme_id: theme._id });
        if (!exists) {
          await Subtheme.create({ name: subName, parent_theme_id: theme._id, owner_id });
        }
      }
      results.push(themeName);
    }
    res.json({ message: 'Categorías actualizadas', themes: results });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar categorías' });
  }
});

// 3. Eliminar Tema (RESTRICCIÓN: Solo si está vacío)
app.delete('/api/v1/themes/me/:themeId', async (req, res) => {
  try {
    const owner_id = req.headers['x-user-id'];
    const { themeId } = req.params;

    const theme = await Theme.findOne({ _id: themeId, owner_id });
    if (!theme) return res.status(404).json({ error: 'Tema no encontrado' });
    if (theme.name.toLowerCase() === 'general') return res.status(400).json({ error: 'No puedes borrar General' });

    // VERIFICACIÓN: ¿Tiene archivos?
    const filesCount = await Article.countDocuments({ theme_id: themeId, owner_id });
    if (filesCount > 0) {
      return res.status(400).json({ error: 'No puedes eliminar un tema que contiene archivos. Mueve o elimina los archivos primero.' });
    }

    await Subtheme.deleteMany({ parent_theme_id: themeId });
    await Theme.findByIdAndDelete(themeId);
    res.json({ message: 'Tema eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// 4. Eliminar Subtema (RESTRICCIÓN: Solo si está vacío)
app.delete('/api/v1/subthemes/me/:subthemeId', async (req, res) => {
  try {
    const owner_id = req.headers['x-user-id'];
    const { subthemeId } = req.params;

    const subtheme = await Subtheme.findOne({ _id: subthemeId, owner_id });
    if (!subtheme) return res.status(404).json({ error: 'Subtema no encontrado' });
    if (subtheme.name.toLowerCase() === 'otros') return res.status(400).json({ error: 'No puedes borrar la subcategoría Otros' });

    // VERIFICACIÓN: ¿Tiene archivos?
    const filesCount = await Article.countDocuments({ subtheme_id: subthemeId, owner_id });
    if (filesCount > 0) {
      return res.status(400).json({ error: 'No puedes eliminar un subtema que contiene archivos.' });
    }

    await Subtheme.findByIdAndDelete(subthemeId);
    res.json({ message: 'Subtema eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(` Metadata Service escuchando en puerto ${PORT}`));