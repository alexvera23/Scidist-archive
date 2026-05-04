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
  { id: 'linux', name: 'Linux', subthemes: ['Arch Linux', 'Ubuntu', 'Fedora'] }
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
  .catch(err => console.error('❌ Error de conexión Mongo:', err.message));


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

    // 2. Crear las categorías y subcategorías elegidas en el registro
    // preferences tiene este formato: { "Redes": ["Protocolos", "Seguridad"], "Linux": ["Fedora"] }
    for (const [themeName, subthemes] of Object.entries(preferences)) {
      const theme = new Theme({ name: themeName, owner_id: newUser._id });
      await theme.save();

      for (const subName of subthemes) {
        const subtheme = new Subtheme({ 
          name: subName, 
          theme_id: theme._id, 
          owner_id: newUser._id 
        });
        await subtheme.save();
      }
    }

    console.log(` Nuevo usuario registrado: ${username}`);
    res.status(201).json({ message: "Usuario y preferencias creados", userId: newUser._id });
  } catch (error) {
    console.error(" Error en registro:", error);
    res.status(500).json({ error: "Error al registrar usuario: " + error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(` Metadata Service escuchando en puerto ${PORT}`));