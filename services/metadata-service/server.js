const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const { Article, StorageMap } = require('./models');

const app = express();
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log(' Conectado al Replica Set de MongoDB');
    try {
      await Article.createCollection();
      await StorageMap.createCollection();
      console.log(' Colecciones inicializadas y listas para transacciones');
    } catch (err) {
      if (err.code !== 48) console.error('Error creando colecciones:', err);
    }
  })
  .catch(err => console.error(' Error de conexión:', err));

app.get('/health', (req, res) => {
  res.json({ status: 'Metadata Service is running', db: mongoose.connection.readyState });
});

// NUEVO: Consultar dónde está un archivo y su nombre original
app.get('/api/v1/articles/:hash', async (req, res) => {
  try {
    const file_hash = req.params.hash;
    // Buscamos la info lógica (nombre) y la física (nodo)
    const article = await Article.findOne({ file_hash });
    const storage = await StorageMap.findOne({ file_hash, status: 'synced' });

    if (!article || !storage) {
      return res.status(404).json({ error: 'Archivo no encontrado en la red' });
    }

    res.status(200).json({
      title: article.title,
      node_id: storage.node_id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error consultando la base de datos' });
  }
});

// MODIFICAR: Crear artículo y programar tarea de replicación
app.post('/api/v1/articles', async (req, res) => {
  const { file_hash, title, node_id, replica_node_id } = req.body; // Recibimos la réplica

  if (!file_hash || !title || !node_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const newArticle = new Article({ file_hash, title, status: 'available' });
    const savedArticle = await Article.create([newArticle], { session });

    const newStorageMap = new StorageMap({ file_hash, node_id, is_primary: true, status: 'synced' });
    await StorageMap.create([newStorageMap], { session });

    // NUEVO: Si hay un nodo de réplica, creamos la tarea asíncrona
    if (replica_node_id && replica_node_id !== node_id) {
      const { ReplicationTask } = require('./models');
      const task = new ReplicationTask({
        file_hash,
        source_node: node_id,
        target_node: replica_node_id,
        status: 'pending'
      });
      await ReplicationTask.create([task], { session });
    }

    await session.commitTransaction();
    session.endSession();
    res.status(201).json({ message: 'Registrado con éxito', article_id: savedArticle[0]._id });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: 'Error en transacción' });
  }
});

// NUEVO: Endpoint para que un nodo pida sus tareas pendientes
app.get('/api/v1/replication-tasks/:node_id', async (req, res) => {
  const { ReplicationTask } = require('./models');
  try {
    const tasks = await ReplicationTask.find({ 
      source_node: req.params.node_id, 
      status: 'pending' 
    }).limit(5); // Procesamos de 5 en 5 para no saturar
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando tareas' });
  }
});

// NUEVO: Endpoint para que un nodo confirme que terminó la copia
app.post('/api/v1/replication-tasks/complete', async (req, res) => {
  const { task_id, file_hash, target_node } = req.body;
  const { ReplicationTask } = require('./models');

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Marcamos la tarea como terminada
    await ReplicationTask.findByIdAndUpdate(task_id, { status: 'done' }, { session });
    
    // Registramos que el nodo secundario ya tiene el archivo
    const newStorageMap = new StorageMap({ file_hash, node_id: target_node, is_primary: false, status: 'synced' });
    await StorageMap.create([newStorageMap], { session });

    await session.commitTransaction();
    session.endSession();
    res.json({ message: 'Replicación completada y registrada' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: 'Error confirmando replicación' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(` Metadata Service escuchando en puerto ${PORT}`);
});