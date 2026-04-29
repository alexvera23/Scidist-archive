const mongoose = require('mongoose');


//  MODELOS DE IDENTIDAD Y CLASIFICACIÓN


// 1. Usuarios (Propietarios de los archivos y temas)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true });

// 2. Temas (Nivel 1 de clasificación, propios de cada usuario)
const ThemeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

// 3. Subtemas (Nivel 2 de clasificación, pertenecen a un Tema y a un Usuario)
const SubthemeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  parent_theme_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Theme', required: true },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

// 4. Artículos (Actualizado para ser privado y tener tema/subtema)
const ArticleSchema = new mongoose.Schema({
  file_hash: { type: String, required: true, index: true },
  title: String,
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ¡El dueño!
  theme_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Theme' },       // Clasificación Nivel 1
  subtheme_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subtheme' }, // Clasificación Nivel 2 (Opcional)
  status: { type: String, enum: ['uploading', 'available', 'deleted', 'error'], default: 'available' }
}, { timestamps: true });


//  MODELOS DEL SISTEMA P2P (INTACTOS)


// Mapa de Almacenamiento
const StorageMapSchema = new mongoose.Schema({
  file_hash: { type: String, required: true, index: true },
  node_id: { type: String, required: true },
  is_primary: { type: Boolean, default: false },
  version: { type: Number, default: 1 },
  status: { type: String, enum: ['synced', 'error'], default: 'synced' }
});O

// Tareas de Replicación
const ReplicationTaskSchema = new mongoose.Schema({
  file_hash: { type: String, required: true },
  source_node: String,
  target_node: String,
  task_type: { type: String, default: 'REPLICATE' },
  status: { type: String, enum: ['pending', 'in_progress', 'done', 'failed'], default: 'pending' },
  retry_count: { type: Number, default: 0 }
}, { timestamps: true });

// Salud de los Nodos
const NodeHealthSchema = new mongoose.Schema({
  node_id: { type: String, required: true, index: true },
  status: { type: String, enum: ['up', 'down'] },
  last_heartbeat: Date
});

//Nuevo modelo Para el directorio de los nodos 

const ActiveNodeSchema = new mongoose.Schema({
  node_id: { type: String, required: true, unique: true },
  address: { type: String, required: true }, // Ejemplo: "192.168.1.15:50051"
  last_seen: { type: Date, default: Date.now }
});

module.exports = {
  User: mongoose.model('User', UserSchema),
  Theme: mongoose.model('Theme', ThemeSchema),
  Subtheme: mongoose.model('Subtheme', SubthemeSchema),
  Article: mongoose.model('Article', ArticleSchema),
  StorageMap: mongoose.model('StorageMap', StorageMapSchema),
  ReplicationTask: mongoose.model('ReplicationTask', ReplicationTaskSchema),
  NodeHealth: mongoose.model('NodeHealth', NodeHealthSchema),
  ActiveNode: mongoose.model('ActiveNode',ActiveNodeSchema)

};