const express = require('express');
const mongoose = require('mongoose');
const dgram = require('dgram');
require('dotenv').config();

const { User, Theme, Subtheme, Article, StorageMap, NodeHealth, ReplicationTask, ActiveNode } = require('./models');

const app = express();
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo1:27017,mongo2:27017,mongo3:27017/scidist?replicaSet=rs0&serverSelectionTimeoutMS=5000';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Conectado al Replica Set de MongoDB');
    try {
      await User.createCollection();
      await Theme.createCollection();
      await Subtheme.createCollection();
      await Article.createCollection();
      await StorageMap.createCollection();
      await ReplicationTask.createCollection();
      await NodeHealth.createCollection();
      await ActiveNode.createCollection();
      console.log('Colecciones Multi-Tenant inicializadas');
    } catch (err) {
      if (err.code !== 48) console.error('Error creando colecciones:', err);
    }
  })
  .catch(err => console.error('Error de conexión Mongo:', err));


app.post('/api/v1/setup-test-user', async (req, res) => {
  try {
    const testUser = new User({
      username: `cientifico_${Date.now()}`,
      email: `test_${Date.now()}@scidist.com`,
      password: 'hashed_password_placeholder'
    });
    await testUser.save();

    const themeGeneral = new Theme({ name: 'General', owner_id: testUser._id });
    const themeRedes = new Theme({ name: 'Redes', owner_id: testUser._id });
    await themeGeneral.save();
    await themeRedes.save();

    const subProtocolos = new Subtheme({ name: 'Protocolos', parent_theme_id: themeRedes._id, owner_id: testUser._id });
    const subTopologias = new Subtheme({ name: 'Topologias', parent_theme_id: themeRedes._id, owner_id: testUser._id });
    await subProtocolos.save();
    await subTopologias.save();

    res.status(201).json({
      message: 'Entorno de prueba creado',
      user_id: testUser._id,
      themes: { general_id: themeGeneral._id, redes_id: themeRedes._id },
      subthemes: { protocolos_id: subProtocolos._id, topologias_id: subTopologias._id }
    });
  } catch (error) {
    res.status(500).json({ error: 'Fallo al crear entorno de prueba', details: error.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// SERVIDOR UDP (HEARTBEATS)
// ─────────────────────────────────────────────────────────────────────────────
const udpServer = dgram.createSocket('udp4');

udpServer.on('message', async (msg, _rinfo) => {
  try {
    const data = JSON.parse(msg);
    if (data.node_id) {
      await NodeHealth.findOneAndUpdate(
        { node_id: data.node_id },
        { status: 'up', last_heartbeat: new Date(data.timestamp) },
        { upsert: true, new: true }
      );
    }
  } catch (_) {}
});

udpServer.on('error', (err) => console.error(`[UDP] Error crítico: ${err.message}`));
udpServer.bind(3002, '0.0.0.0', () => console.log('Servidor UDP escuchando en 0.0.0.0:3002'));

setInterval(async () => {
  try {
    const threshold = new Date(Date.now() - 15000);
    await NodeHealth.updateMany(
      { last_heartbeat: { $lt: threshold }, status: 'up' },
      { $set: { status: 'down' } }
    );
  } catch (_) {}
}, 10000);


// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINTS HTTP
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/v1/articles/:hash', async (req, res) => {
  try {
    const file_hash = req.params.hash;
    const { owner_id } = req.query;

    if (!owner_id) return res.status(400).json({ error: 'Falta owner_id' });

    const article = await Article.findOne({ file_hash, owner_id });
    if (!article) return res.status(404).json({ error: 'No encontrado o no tienes permisos' });

    const storages = await StorageMap.find({ file_hash, status: 'synced' });
    if (storages.length === 0) return res.status(404).json({ error: 'Físicamente no encontrado' });

    const activeNodes = await NodeHealth.find({ status: 'up' }).select('node_id');
    const activeNodeIds = new Set(activeNodes.map(n => n.node_id));
    const availableStorages = storages.filter(s => activeNodeIds.has(s.node_id));

    if (availableStorages.length === 0) return res.status(503).json({ error: 'Nodos fuera de línea' });

    // Ordenar: primario primero, réplicas después. El Gateway iterará esta
    // lista en orden hasta que un nodo responda correctamente (failover).
    const ordered = [
      ...availableStorages.filter(s => s.is_primary),
      ...availableStorages.filter(s => !s.is_primary)
    ];

    // Cruzar con ActiveNode para obtener las direcciones gRPC
    const activeNodeDocs = await ActiveNode.find({ node_id: { $in: ordered.map(s => s.node_id) } });
    const addressMap = Object.fromEntries(activeNodeDocs.map(n => [n.node_id, n.address]));

    const candidateNodes = ordered
      .filter(s => addressMap[s.node_id])   // descartar nodos sin dirección registrada
      .map(s => ({
        node_id: s.node_id,
        address: addressMap[s.node_id],
        is_primary: s.is_primary
      }));

    if (candidateNodes.length === 0) return res.status(503).json({ error: 'Nodos fuera de línea' });

    res.status(200).json({
      title: article.title,
      // Campo legacy para compatibilidad con otros servicios que puedan usarlo
      node_id: candidateNodes[0].node_id,
      // Lista completa ordenada para que el Gateway haga failover
      candidate_nodes: candidateNodes
    });
  } catch (error) {
    res.status(500).json({ error: 'Error BD' });
  }
});

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

app.post('/api/v1/articles', async (req, res) => {
  const { file_hash, title, owner_id, theme_id, subtheme_id, node_id, replicas } = req.body;

  if (!file_hash || !title || !owner_id || !node_id) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // =====================================================================
    // FIX PROBLEMA 2 (parte A): Limpiar restos de una subida anterior
    // del mismo hash. Si el archivo fue eliminado antes, pueden quedar
    // StorageMap en status 'synced' que apuntan a nodos viejos/caídos.
    // Los borramos dentro de la misma transacción antes de insertar.
    // =====================================================================
    await StorageMap.deleteMany({ file_hash }, { session });

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

app.get('/api/v1/replication-tasks/:node_id', async (req, res) => {
  try {
    const nodeId = req.params.node_id;
    const tasks = await ReplicationTask.find({
      status: 'pending',
      $or: [
        { source_node: nodeId, task_type: { $ne: 'DELETE' } },
        { target_node: nodeId, task_type: 'DELETE' }
      ]
    });
    res.json(tasks);
  } catch (error) {
    console.error('Error obteniendo tareas:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/api/v1/replication-tasks/complete', async (req, res) => {
  const { task_id, file_hash, target_node, task_type } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await ReplicationTask.findByIdAndUpdate(task_id, { status: 'done' }, { session });

    if (task_type === 'DELETE') {
      const pendingDeletes = await ReplicationTask.countDocuments(
        { file_hash, task_type: 'DELETE', status: { $ne: 'done' } },
        { session }
      );

      if (pendingDeletes === 0) {
        // =====================================================================
        // FIX PROBLEMA 2 (parte B): Limpiar StorageMap al completar DELETE.
        // Antes solo se borraba el Article. Ahora también se purgan los
        // registros de StorageMap para ese hash, de modo que una re-subida
        // del mismo archivo no encuentre nodos viejos/caídos como destino.
        // =====================================================================
        await Article.findOneAndDelete({ file_hash }, { session });
        await StorageMap.deleteMany({ file_hash }, { session });
        console.log(`[Metadata] Archivo ${file_hash} purgado completamente de BD (Article + StorageMap).`);
      }
    } else if (task_type === 'REPLICATE') {
      const newMap = new StorageMap({ file_hash, node_id: target_node, is_primary: false, status: 'synced' });
      await newMap.save({ session });
    }
    // REPLICATE_SKIPPED: la tarea se cierra sin insertar nada en StorageMap.

    await session.commitTransaction();
    session.endSession();
    res.json({ message: 'OK' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: 'Error' });
  }
});

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

app.get('/api/v1/nodes', async (req, res) => {
  try {
    const nodes = await ActiveNode.find();
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener nodos' });
  }
});

// =====================================================================
// FIX PROBLEMA 2 (parte C): Nuevo endpoint /nodes/active.
// Cruza ActiveNode con NodeHealth para devolver SOLO los nodos que
// han enviado latido en los últimos 15s. El Gateway usará este
// endpoint para el hash-routing de uploads, garantizando que nunca
// intente enviar un archivo a un nodo caído.
// =====================================================================
app.get('/api/v1/nodes/active', async (req, res) => {
  try {
    const healthyNodes = await NodeHealth.find({ status: 'up' }).select('node_id');
    const healthyIds = new Set(healthyNodes.map(n => n.node_id));

    const nodes = await ActiveNode.find({ node_id: { $in: [...healthyIds] } });
    res.json(nodes);
  } catch (error) {
    console.error('[Registry] Error obteniendo nodos activos:', error);
    res.status(500).json({ error: 'Error al obtener nodos activos' });
  }
});

// =====================================================================
// FIX PROBLEMA 1 (parte D — en Metadata): Eliminación distribuida.
// ANTES de crear las tareas DELETE, se cancelan todas las tareas
// REPLICATE pendientes para ese hash. Así el P2P Worker del nodo
// primario no intenta replicar un archivo que está siendo borrado.
// =====================================================================
app.delete('/api/v1/articles/:hash', async (req, res) => {
  const { hash } = req.params;
  const { owner_id } = req.query;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const article = await Article.findOne({ file_hash: hash, owner_id }).session(session);
    if (!article) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Archivo no encontrado o acceso denegado' });
    }

    const storageMaps = await StorageMap.find({ file_hash: hash, status: 'synced' }).session(session);
    const nodesWithFile = storageMaps.map(s => s.node_id);

    if (nodesWithFile.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'No se encontraron nodos con ese archivo' });
    }

    // ── FIX: cancelar REPLICATE pendientes antes de crear DELETE tasks ──
    const cancelledCount = await ReplicationTask.updateMany(
      { file_hash: hash, task_type: { $ne: 'DELETE' }, status: 'pending' },
      { $set: { status: 'done' } },
      { session }
    );
    if (cancelledCount.modifiedCount > 0) {
      console.log(`[Metadata] Canceladas ${cancelledCount.modifiedCount} tareas REPLICATE pendientes para ${hash}.`);
    }

    // Crear una tarea DELETE por cada nodo que tiene el archivo
    for (const nodeId of nodesWithFile) {
      await ReplicationTask.create([{
        file_hash: hash,
        source_node: 'SYSTEM',
        target_node: nodeId,
        task_type: 'DELETE'
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    console.log(`[Metadata] Eliminación distribuida iniciada para: ${hash} en nodos: ${nodesWithFile.join(', ')}`);
    res.status(200).json({ message: 'Orden de eliminación distribuida enviada con éxito' });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('[Metadata] Error en eliminación:', error);
    res.status(500).json({ error: 'Fallo al iniciar el borrado' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Metadata Service escuchando en puerto ${PORT}`));