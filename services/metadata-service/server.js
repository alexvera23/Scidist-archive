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
    
    // SOLUCIÓN: Crear colecciones explícitamente para permitir transacciones
    try {
      await Article.createCollection();
      await StorageMap.createCollection();
      console.log(' Colecciones inicializadas y listas para transacciones');
    } catch (err) {
      // Ignoramos el error si la colección ya existe (NamespaceExists)
      if (err.code !== 48) console.error('Error creando colecciones:', err);
    }
  })
  .catch(err => console.error(' Error de conexión:', err));

app.get('/health', (req, res) => {
  res.json({ status: 'Metadata Service is running', db: mongoose.connection.readyState });
});

app.post('/api/v1/articles', async (req, res) => {
  const { file_hash, title, node_id } = req.body;

  if (!file_hash || !title || !node_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const newArticle = new Article({
      file_hash,
      title,
      status: 'available'
    });
    // Pasamos el array con un elemento para usar la sintaxis correcta en transacciones de mongoose
    const savedArticle = await Article.create([newArticle], { session });

    const newStorageMap = new StorageMap({
      file_hash,
      node_id,
      is_primary: true,
      status: 'synced'
    });
    await StorageMap.create([newStorageMap], { session });

    await session.commitTransaction();
    session.endSession();

    console.log(`[Metadata]  Metadatos registrados para: ${file_hash}`);
    res.status(201).json({ message: 'Metadatos registrados con éxito', article_id: savedArticle[0]._id });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('[Metadata]  Error en la transacción:', error);
    res.status(500).json({ error: 'Error al registrar metadatos en la base de datos' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(` Metadata Service escuchando en puerto ${PORT}`);
});