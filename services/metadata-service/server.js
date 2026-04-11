const express = require('express');
const mongoose = require('mongoose');
const dgram = require('dgram');
require('dotenv').config();

const { Article, StorageMap, NodeHealth, ReplicationTask } = require('./models');

const app = express();
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Conectado al Replica Set de MongoDB');
    try {
      await Article.createCollection();
      await StorageMap.createCollection();
      await ReplicationTask.createCollection();
      await NodeHealth.createCollection();
      console.log('✅ Todas las colecciones inicializadas');
    } catch (err) {
      if (err.code !== 48) console.error('❌ Error creando colecciones:', err);
    }
  })
  .catch(err => console.error('❌ Error de conexión Mongo:', err));

// ==========================================
// 💓 SERVIDOR UDP (HEARTBEATS)
// ==========================================
const udpServer = dgram.createSocket('udp4');

udpServer.on('message', async (msg, rinfo) => {
  try {
    const data = JSON.parse(msg);
    // LOG CHISMOSO: Imprimimos cada vez que llega un latido
    console.log(`[UDP] 💓 Latido de ${data.node_id} desde ${rinfo.address}`);
    
    if (data.node_id) {
      await NodeHealth.findOneAndUpdate(
        { node_id: data.node_id },
        { status: 'up', last_heartbeat: new Date(data.timestamp) },
        { upsert: true, new: true }
      );
    }
  } catch (e) {
    console.error('❌ [UDP] Error al guardar el latido en DB:', e.message);
  }
});

udpServer.on('error', (err) => {
  console.error(`❌ [UDP] Error crítico en el servidor: ${err.message}`);
});

// Forzamos a que escuche en todas las interfaces de red (0.0.0.0)
udpServer.bind(3002, '0.0.0.0', () => {
  console.log('💓 Servidor UDP escuchando latidos en 0.0.0.0:3002');
});

// Vigilante (Watchdog)
setInterval(async () => {
  try {
    const threshold = new Date(Date.now() - 15000);
    const res = await NodeHealth.updateMany(
      { last_heartbeat: { $lt: threshold }, status: 'up' },
      { $set: { status: 'down' } }
    );
    if (res.modifiedCount > 0) {
      console.log(`[Vigilante] ⚠️ Se marcaron ${res.modifiedCount} nodos como DOWN`);
    }
  } catch (e) {
    console.error('❌ [Vigilante] Error:', e.message);
  }
}, 10000);

// ==========================================
// ENDPOINTS HTTP
// ==========================================

app.get('/api/v1/articles/:hash', async (req, res) => {
  try {
    const file_hash = req.params.hash;
    const article = await Article.findOne({ file_hash });
    const storages = await StorageMap.find({ file_hash, status: 'synced' });

    if (!article || storages.length === 0) return res.status(404).json({ error: 'No encontrado' });

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

app.post('/api/v1/articles', async (req, res) => {
  const { file_hash, title, node_id, replicas } = req.body; 

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(`[Metadata] Iniciando transacción para: ${file_hash}`);
    
    // Usamos .save({ session }) que es más seguro que .create([]) para Mongoose
    const newArticle = new Article({ file_hash, title, status: 'available' });
    await newArticle.save({ session });

    const newStorageMap = new StorageMap({ file_hash, node_id, is_primary: true, status: 'synced' });
    await newStorageMap.save({ session });

    if (replicas && replicas.length > 0) {
      const tasks = replicas.map(replica_id => ({
        file_hash,
        source_node: node_id,
        target_node: replica_id,
        status: 'pending'
      }));
      // insertMany es la forma correcta de guardar arrays en transacciones
      await ReplicationTask.insertMany(tasks, { session });
    }

    await session.commitTransaction();
    session.endSession();
    console.log(`[Metadata] ✅ Transacción EXITOSA para: ${file_hash}`);
    res.status(201).json({ message: 'Registrado con éxito', article_id: newArticle._id });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    // AQUÍ ESTÁ LA MAGIA: Esto nos dirá EXACTAMENTE qué falló
    console.error('❌ [Metadata] ERROR EN LA TRANSACCIÓN:', error);
    res.status(500).json({ error: 'Error en transacción', details: error.message });
  }
});

app.get('/api/v1/replication-tasks/:node_id', async (req, res) => {
  try {
    const tasks = await ReplicationTask.find({ source_node: req.params.node_id, status: 'pending' }).limit(5);
    res.json(tasks);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/v1/replication-tasks/complete', async (req, res) => {
  const { task_id, file_hash, target_node } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await ReplicationTask.findByIdAndUpdate(task_id, { status: 'done' }, { session });
    const newMap = new StorageMap({ file_hash, node_id: target_node, is_primary: false, status: 'synced' });
    await newMap.save({ session });
    await session.commitTransaction();
    session.endSession();
    res.json({ message: 'OK' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: 'Error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Metadata Service escuchando en puerto ${PORT}`));