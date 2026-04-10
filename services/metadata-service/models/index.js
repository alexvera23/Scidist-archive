const mongoose = require('mongoose');

// 1. Esquema de Usuarios
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'scientist'], default: 'scientist' }
}, { timestamps: true });

// 2. Esquema de Artículos
const ArticleSchema = new mongoose.Schema({
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  file_hash: { type: String, required: true, index: true },
  title: String,
  authors: [String],
  abstract: String,
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  status: { type: String, enum: ['uploading', 'processing', 'available', 'error'], default: 'uploading' }
}, { timestamps: true });

// 3. Mapa de Almacenamiento
const StorageMapSchema = new mongoose.Schema({
  file_hash: { type: String, required: true, index: true },
  node_id: { type: String, required: true },
  is_primary: { type: Boolean, default: false },
  version: { type: Number, default: 1 },
  status: { type: String, enum: ['synced', 'error'], default: 'synced' }
});

// 4. Tareas de Replicación
const ReplicationTaskSchema = new mongoose.Schema({
  file_hash: { type: String, required: true },
  source_node: String,
  target_node: String,
  status: { type: String, enum: ['pending', 'in_progress', 'done', 'failed'], default: 'pending' },
  retry_count: { type: Number, default: 0 }
}, { timestamps: true });

// 5. Categoría (Aquí estaba el error)
const CategorySchema = new mongoose.Schema({ 
  name: String, 
  description: String 
});

// 6. Salud del Nodo
const NodeHealthSchema = new mongoose.Schema({
  node_id: String,
  status: String,
  last_heartbeat: Date,
  stats: { free_space: Number, load_avg: Number }
});

module.exports = {
  User: mongoose.model('User', UserSchema),
  Article: mongoose.model('Article', ArticleSchema),
  Category: mongoose.model('Category', CategorySchema), // ¡Corregido!
  StorageMap: mongoose.model('StorageMap', StorageMapSchema),
  ReplicationTask: mongoose.model('ReplicationTask', ReplicationTaskSchema),
  NodeHealth: mongoose.model('NodeHealth', NodeHealthSchema)
};