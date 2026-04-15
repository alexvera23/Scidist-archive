const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const axios = require('axios');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// 1. Configuración de gRPC Client
const PROTO_PATH = path.join(__dirname, 'proto', 'storage.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const storageProto = grpc.loadPackageDefinition(packageDefinition).storage;

// 2. Configuración de Multer (Manejo de archivos subidos por HTTP)
// Guardamos temporalmente en el Gateway antes de enviarlo por gRPC
const upload = multer({ dest: 'temp_uploads/' });

// Lista de nodos de almacenamiento disponibles (Simulando Service Discovery)
const STORAGE_NODES = [
  { id: 'storage-node-1', address: 'storage-node-1:50051' },
  { id: 'storage-node-2', address: 'storage-node-2:50051' },
  { id: 'storage-node-3', address: 'storage-node-3:50051' } // NUEVO NODO
];

/**
 * Lógica de Anillo (Ring Logic) para Factor de Replicación 3
 */
function getRoutingNodes(fileHash) {
  const hashInt = parseInt(fileHash.substring(0, 8), 16);
  const primaryIndex = hashInt % STORAGE_NODES.length;
  // Los dos siguientes nodos en el anillo son las réplicas
  const replica1Index = (primaryIndex + 1) % STORAGE_NODES.length; 
  const replica2Index = (primaryIndex + 2) % STORAGE_NODES.length; 
  
  return {
    primary: STORAGE_NODES[primaryIndex],
    replicas: [STORAGE_NODES[replica1Index], STORAGE_NODES[replica2Index]]
  };
}

// ==========================================
// ENDPOINT: SUBIR ARCHIVO (Ahora requiere Usuario y simula IA)
// ==========================================
app.post('/api/v1/upload', upload.single('file'), async (req, res) => {
  // 1. EXTRAER IDENTIDAD (Simulamos que un middleware ya validó el token)
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(401).json({ error: 'Falta la cabecera x-user-id' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No se envió ningún archivo' });
  }

  const tempPath = req.file.path;
  const originalName = req.file.originalname;
  const extension = path.extname(originalName);

  try {
    const fileBuffer = fs.readFileSync(tempPath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const fileHash = hashSum.digest('hex');

    const { primary: targetNode, replicas: replicaNodes } = getRoutingNodes(fileHash);

    // ==========================================
    // ESPACIO RESERVADO PARA LA IA (FUTURO)
    // Aquí es donde el Gateway enviará el texto a Python.
    // Por ahora, le asignaremos IDs vacíos o nulos para que vaya a "General"
    // ==========================================
    const theme_id = null; // En el futuro vendrá de Python
    const subtheme_id = null; // En el futuro vendrá de Python

    const client = new storageProto.StorageService(targetNode.address, grpc.credentials.createInsecure());

    const call = client.UploadFile(async (error, response) => {
      fs.unlinkSync(tempPath); 
      
      if (error) {
        console.error('[Gateway] Error gRPC:', error);
        return res.status(500).json({ error: 'Error al transferir al nodo de almacenamiento' });
      }

      try {
        const metadataPayload = {
          file_hash: fileHash,
          title: originalName,
          owner_id: userId,          // ¡NUEVO! El dueño del archivo
          theme_id: theme_id,        // ¡NUEVO! Categoría
          subtheme_id: subtheme_id,  // ¡NUEVO! Subcategoría
          node_id: targetNode.id,
          replicas: replicaNodes.map(n => n.id) 
        };

        const metadataResponse = await axios.post('http://metadata-service:3001/api/v1/articles', metadataPayload);
        
        res.status(200).json({
          message: 'Archivo subido, distribuido y registrado con éxito',
          file_hash: fileHash,
          metadata_id: metadataResponse.data.article_id
        });

      } catch (metadataError) {
        const errorDetails = metadataError.response ? metadataError.response.data : metadataError.message;
        console.error('[Gateway] ❌ Error al contactar Metadata Service:', errorDetails);
        res.status(500).json({ error: 'El archivo se guardó pero falló el registro de base de datos' });
      }
    });

    call.write({ info: { file_hash: fileHash, extension: extension } });
    call.write({ chunk: fileBuffer });
    call.end();

  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    res.status(500).json({ error: 'Error interno del Gateway' });
  }
});

// ==========================================
// ENDPOINT: DESCARGAR ARCHIVO (Filtra por Usuario)
// ==========================================
app.get('/api/v1/download/:hash', async (req, res) => {
  const fileHash = req.params.hash;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Falta la cabecera x-user-id' });
  }

  try {
    // Le pasamos el owner_id en la Query String al Metadata Service
    const metadataUrl = `http://metadata-service:3001/api/v1/articles/${fileHash}?owner_id=${userId}`;
    const metadataResponse = await axios.get(metadataUrl);
    const { title, node_id } = metadataResponse.data;

    const targetNode = STORAGE_NODES.find(n => n.id === node_id);
    if (!targetNode) return res.status(500).json({ error: 'Nodo fuera de línea' });

    const client = new storageProto.StorageService(targetNode.address, grpc.credentials.createInsecure());
    const call = client.DownloadFile({ file_hash: fileHash });

    res.setHeader('Content-Disposition', `attachment; filename="${title}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    call.on('data', (response) => res.write(response.chunk));
    call.on('end', () => res.end());
    call.on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ error: 'Error gRPC' });
      else res.end();
    });

  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'El archivo no existe o no te pertenece' });
    }
    res.status(500).json({ error: 'Error interno' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API Gateway escuchando en puerto ${PORT}`));