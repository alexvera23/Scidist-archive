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
  { id: 'storage-node-2', address: 'storage-node-2:50051' }
];

/**
 * Lógica de Anillo (Ring Logic)
 * Elige un nodo primario y su vecino como nodo de réplica.
 */
function getRoutingNodes(fileHash) {
  const hashInt = parseInt(fileHash.substring(0, 8), 16);
  const primaryIndex = hashInt % STORAGE_NODES.length;
  // El vecino en el anillo (si es el último, vuelve al primero)
  const replicaIndex = (primaryIndex + 1) % STORAGE_NODES.length; 
  
  return {
    primary: STORAGE_NODES[primaryIndex],
    replica: STORAGE_NODES[replicaIndex]
  };
}

// 3. Endpoint Principal de Subida
app.post('/api/v1/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envió ningún archivo' });
  }

  const tempPath = req.file.path;
  const originalName = req.file.originalname;
  const extension = path.extname(originalName);

  try {
    // A. Calcular el Hash SHA-256 del archivo
    const fileBuffer = fs.readFileSync(tempPath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const fileHash = hashSum.digest('hex');

    console.log(`[Gateway] Archivo recibido: ${originalName} -> Hash: ${fileHash}`);

    // B. Elegir el nodo primario y la réplica
    const { primary: targetNode, replica: replicaNode } = getRoutingNodes(fileHash);
    console.log(`[Gateway] Nodo Primario: ${targetNode.id} | Nodo Réplica: ${replicaNode.id}`);

    // C. Enviar el archivo vía gRPC
    // C. Enviar el archivo vía gRPC
    const client = new storageProto.StorageService(
      targetNode.address,
      grpc.credentials.createInsecure()
    );

    // Iniciamos el stream gRPC
    const call = client.UploadFile(async (error, response) => {
      // Esta función se ejecuta cuando el Storage Node responde
      fs.unlinkSync(tempPath); // Borrar el archivo temporal del Gateway
      
      if (error) {
        console.error('[Gateway] Error gRPC:', error);
        return res.status(500).json({ error: 'Error al transferir al nodo de almacenamiento' });
      }

      console.log(`[Gateway] Archivo guardado físicamente en: ${targetNode.id}`);

      // D. NUEVO: Llamar al Metadata Service
      try {
        const metadataPayload = {
          file_hash: fileHash,
          title: originalName,
          node_id: targetNode.id,
          replica_node_id: replicaNode.id // ¡Añadimos la réplica aquí!
        };

        // Hacemos un POST a la red interna de Docker (puerto 3001 del metadata-service)
        const metadataResponse = await axios.post('http://metadata-service:3001/api/v1/articles', metadataPayload);
        
        console.log('[Gateway] Metadatos confirmados en MongoDB');

        res.status(200).json({
          message: 'Archivo subido, distribuido y registrado con éxito',
          file_hash: fileHash,
          target_node: targetNode.id,
          metadata_id: metadataResponse.data.article_id
        });

      } catch (metadataError) {
        console.error('[Gateway]  Error al contactar Metadata Service:', metadataError.message);
        // NOTA DISTRIBUIDA: Aquí aplicaríamos un "Saga Pattern" para decirle al 
        // storage-node que borre el archivo porque la base de datos falló.
        res.status(500).json({ error: 'El archivo se guardó pero falló el registro de base de datos' });
      }
    });

    // Enviamos el primer mensaje con los metadatos
    call.write({
      info: { file_hash: fileHash, extension: extension }
    });

    // Enviamos los chunks del archivo (Simulado enviando todo de una vez por ahora para simplificar)
    // En un sistema real de producción, se leería el archivo como stream
    call.write({ chunk: fileBuffer });
    
    // Avisamos que terminamos de enviar
    call.end();

  } catch (metadataError) {
        // Mejoramos el log para ver el error real de Axios
        const errorDetails = metadataError.response ? metadataError.response.data : metadataError.message;
        console.error('[Gateway]  Error al contactar Metadata Service:', errorDetails);
        
        res.status(500).json({ error: 'El archivo se guardó pero falló el registro de base de datos' });
      }
});

// NUEVO ENDPOINT: Descargar Archivo
app.get('/api/v1/download/:hash', async (req, res) => {
  const fileHash = req.params.hash;

  try {
    // 1. Preguntamos al Metadata Service dónde está el archivo
    const metadataUrl = `http://metadata-service:3001/api/v1/articles/${fileHash}`;
    const metadataResponse = await axios.get(metadataUrl);
    const { title, node_id } = metadataResponse.data;

    // Buscamos la IP del nodo en nuestra lista de "Service Discovery"
    const targetNode = STORAGE_NODES.find(n => n.id === node_id);
    if (!targetNode) {
      return res.status(500).json({ error: 'El nodo que tiene el archivo está fuera de línea' });
    }

    console.log(`[Gateway]  Descargando "${title}" (${fileHash}) desde ${targetNode.id}`);

    // 2. Conectamos al nodo por gRPC
    const client = new storageProto.StorageService(
      targetNode.address,
      grpc.credentials.createInsecure()
    );

    const call = client.DownloadFile({ file_hash: fileHash });

    // 3. Preparamos la respuesta HTTP para el navegador del usuario
    res.setHeader('Content-Disposition', `attachment; filename="${title}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // 4. Puenteamos el stream gRPC directo al stream HTTP (Súper eficiente en RAM)
    call.on('data', (response) => {
      res.write(response.chunk);
    });

    call.on('end', () => {
      res.end(); // Terminamos la petición HTTP
      console.log(`[Gateway]  Archivo entregado al cliente con éxito`);
    });

    call.on('error', (err) => {
      console.error('[Gateway]  Error gRPC en descarga:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error obteniendo el archivo del nodo' });
      } else {
        res.end();
      }
    });

  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'El archivo no existe en el sistema distribuido' });
    }
    console.error('[Gateway] Error interno:', error.message);
    res.status(500).json({ error: 'Error interno del Gateway' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` API Gateway escuchando en puerto ${PORT}`);
});