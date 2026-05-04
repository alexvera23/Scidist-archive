const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const axios = require('axios');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js'); // Usamos legacy para evitar problemas con Node 18
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
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
// const STORAGE_NODES = [
//   { id: 'storage-node-1', address: 'storage-node-1:50051' },
//   { id: 'storage-node-2', address: 'storage-node-2:50051' },
//   { id: 'storage-node-3', address: 'storage-node-3:50051' } // NUEVO NODO
// ];
// Función para obtener nodos frescos desde el Metadata Service
async function fetchActiveNodes() {
  try {
    const response = await axios.get('http://metadata-service:3001/api/v1/nodes');
    return response.data; // Retorna [{node_id, address}, ...]
  } catch (error) {
    console.error('[Gateway] No se pudo obtener la lista de nodos');
    return [];
  }
}
/**
 * Lógica de Anillo (Ring Logic) para Factor de Replicación 3
 */
function getRoutingNodes(fileHash, activeNodes) {
  if (activeNodes.length === 0) return null;
  
  const hashInt = parseInt(fileHash.substring(0, 8), 16);
  const primaryIndex = hashInt % activeNodes.length;
  
  // Replicación a los siguientes nodos disponibles
  const replica1Index = (primaryIndex + 1) % activeNodes.length;
  const replica2Index = (primaryIndex + 2) % activeNodes.length;
  
  return {
    primary: activeNodes[primaryIndex],
    replicas: [activeNodes[replica1Index], activeNodes[replica2Index]]
  };
}

// ==========================================
// ENDPOINT: SUBIR ARCHIVO CON INTELIGENCIA ARTIFICIAL
// ==========================================
app.post('/api/v1/upload', upload.single('file'), async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(401).json({ error: 'Falta la cabecera x-user-id' });
  }
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

  const tempPath = req.file.path;
  const originalName = req.file.originalname;
  const extension = path.extname(originalName).toLowerCase();

  try {
    const fileBuffer = fs.readFileSync(tempPath);
    
    // 1. Calcular Hash
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const fileHash = hashSum.digest('hex');

    // 2. EXTRAER TEXTO PARA LA IA
    let extractedText = "";
    try {
      if (extension === '.pdf') {
        const uint8Array = new Uint8Array(fileBuffer);
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdfDocument = await loadingTask.promise;
        
        // Solo leer las primeras 3 páginas para no saturar la memoria
        const numPages = Math.min(3, pdfDocument.numPages); 
        let fullText = "";

        for (let i = 1; i <= numPages; i++) {
          const page = await pdfDocument.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + " ";
        }
        
        // Limpiamos un poco el texto y lo cortamos
        extractedText = fullText.replace(/\s+/g, ' ').substring(0, 2500);
      } else if (extension === '.txt') {
        extractedText = fileBuffer.toString('utf-8').substring(0, 2500);
      }
    } catch (parseError) {
      console.error('[Gateway]  Advertencia: No se pudo extraer texto para la IA:', parseError.message);
      // No rompemos el flujo. Si no hay texto, irá a la categoría "General"
    }

    // 3. OBTENER CATEGORÍAS DEL USUARIO
    let candidateLabels = [];
    let categoryMap = {}; // Para saber qué ID corresponde a cada nombre
    let generalThemeId = null;

    try {
      const catResponse = await axios.get(`http://metadata-service:3001/api/v1/users/${userId}/categories`);
      const { themes, subthemes } = catResponse.data;

      // Mapear Temas (Buscamos "General" como respaldo)
      themes.forEach(t => {
        if (t.name.toLowerCase() === 'general') {
          generalThemeId = t._id;
        } else {
          candidateLabels.push(t.name);
          categoryMap[t.name] = { theme_id: t._id, subtheme_id: null };
        }
      });

      // Mapear Subtemas
      subthemes.forEach(st => {
        candidateLabels.push(st.name);
        categoryMap[st.name] = { theme_id: st.parent_theme_id, subtheme_id: st._id };
      });
    } catch (catError) {
      console.error('[Gateway] Error obteniendo categorías:', catError.message);
    }

    // 4. VALIDACIÓN Y CLASIFICACIÓN CON IA
    let finalThemeId = generalThemeId; 
    let finalSubthemeId = null;

    if (extractedText.trim().length > 50 && candidateLabels.length > 0) {
      try {
        // --- PASO A: VALIDACIÓN IMRyD ---
        console.log(`[Gateway] Validando estructura científica (IMRyD)...`);
        const validationLabels = ["artículo científico (IMRyD)", "documento genérico", "publicidad o spam"];
        
        const validationResponse = await axios.post('http://classifier-service:8000/classify', {
          text: extractedText,
          candidate_labels: validationLabels
        });

        const isValid = validationResponse.data.best_label === "artículo científico (IMRyD)";
        const validationConfidence = validationResponse.data.confidence;

        if (!isValid || validationConfidence < 0.4) {
          console.log(`[Gateway]  Archivo rechazado: No parece un artículo científico (${(validationConfidence*100).toFixed(1)}%)`);
          fs.unlinkSync(tempPath);
          return res.status(400).json({ 
            error: "El archivo no cumple con la estructura de un artículo científico (IMRyD)." 
          });
        }

        console.log(`[Gateway]  Estructura validada con ${(validationConfidence*100).toFixed(1)}% de confianza.`);

        // --- PASO B: CLASIFICACIÓN TEMÁTICA (Solo si pasó el paso A) ---
        const aiResponse = await axios.post('http://classifier-service:8000/classify', {
          text: extractedText,
          candidate_labels: candidateLabels
        });

        const { best_label, confidence } = aiResponse.data;
        if (confidence > 0.3) {
          finalThemeId = categoryMap[best_label].theme_id;
          finalSubthemeId = categoryMap[best_label].subtheme_id;
          console.log(`[IA] Clasificado en: ${best_label} (${(confidence*100).toFixed(1)}%)`);
        }

      } catch (aiError) {
        console.error('[Gateway] Error en validación IA:', aiError.message);
        // En caso de error de la IA, podemos ser conservadores y mandarlo a General
      }
    }

    // 5. CONSULTA DINÁMICA DE NODOS ACTIVOS
    const activeNodes = await fetchActiveNodes();
    if (activeNodes.length === 0) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return res.status(503).json({ error: 'No hay nodos de almacenamiento disponibles en la red' });
    }

    // 6. ENRUTAMIENTO P2P Y TRANSFERENCIA gRPC (CON FAILOVER)
    const { primary: targetNode, replicas: replicaNodes } = getRoutingNodes(fileHash, activeNodes);
    
    // Armamos nuestra lista de candidatos: Primario primero, réplicas después
    const candidateNodes = [targetNode, ...replicaNodes];
    
    let uploadSuccess = false;
    let successfulNode = null;

    // Intentamos subir el archivo iterando sobre los nodos disponibles
    for (const node of candidateNodes) {
      try {
        console.log(`[Gateway] Intentando subir a: ${node.node_id}`);
        
        await new Promise((resolve, reject) => {
          const client = new storageProto.StorageService(node.address, grpc.credentials.createInsecure());
          
          const call = client.UploadFile((error, response) => {
            if (error) return reject(error);
            resolve(response);
          });

          // Escribimos los metadatos y el buffer del archivo
          call.write({ info: { file_hash: fileHash, extension: extension } });
          call.write({ chunk: fileBuffer }); // Ya lo teníamos en memoria, muy conveniente
          call.end();
        });

        // Si la promesa se resuelve sin errores, marcamos el éxito y salimos del bucle
        uploadSuccess = true;
        successfulNode = node;
        console.log(`[Gateway]  Subida exitosa a ${node.node_id}`);
        break; 

      } catch (grpcErr) {
        console.warn(`[Gateway]  Falló gRPC en ${node.node_id}. Saltando al siguiente...`);
      }
    }

    // Ya no necesitamos el archivo temporal, lo borramos siempre
    fs.unlinkSync(tempPath);

    if (!uploadSuccess) {
      return res.status(503).json({ error: 'Error crítico: Ningún nodo de la red pudo recibir el archivo.' });
    }
     // 7. GUARDAR EN BASE DE DATOS DISTRIBUIDA
    try {
      // Determinamos quiénes quedan como réplicas basándonos en el nodo que realmente respondió
      const finalReplicas = candidateNodes
        .map(n => n.node_id)
        .filter(id => id !== successfulNode.node_id);

      const metadataPayload = {
        file_hash: fileHash,
        title: originalName,
        owner_id: userId,          
        theme_id: finalThemeId,        
        subtheme_id: finalSubthemeId,  
        node_id: successfulNode.node_id, // El héroe que respondió
        replicas: finalReplicas 
      };

      const metadataResponse = await axios.post('http://metadata-service:3001/api/v1/articles', metadataPayload);
      
      res.status(200).json({
        message: 'Archivo analizado por IA, distribuido y registrado',
        file_hash: fileHash,
        classification: {
          assigned_theme_id: finalThemeId,
          assigned_subtheme_id: finalSubthemeId
        }
      });

    } catch (metadataError) {
      res.status(500).json({ error: 'El archivo se subió, pero falló el registro en base de datos' });
    }
  } catch (error) {
    console.error('[Gateway] Error en upload:', error);
    res.status(500).json({ error: 'Error al procesar el archivo' });
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
    // 1. CONSULTA DINÁMICA PARA LOCALIZAR EL NODO
    const activeNodes = await fetchActiveNodes();
    if (activeNodes.length === 0) {
      return res.status(503).json({ error: 'No hay nodos de almacenamiento disponibles en la red' });
    }

    // 2. OBTENER METADATOS DEL ARCHIVO
    const metadataUrl = `http://metadata-service:3001/api/v1/articles/${fileHash}?owner_id=${userId}`;
    const metadataResponse = await axios.get(metadataUrl);
    const { title, node_id } = metadataResponse.data;

    // 3. BUSCAR EL NODO ACTIVO QUE CONTIENE EL ARCHIVO
    const targetNode = activeNodes.find(n => n.node_id === node_id);
    if (!targetNode) return res.status(503).json({ error: 'El nodo que contiene el archivo no está accesible actualmente' });

    // 4. CONEXIÓN gRPC AL NODO ENCONTRADO DINÁMICAMENTE
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

// ==========================================
// ENDPOINT: BORRAR ARCHIVO
// ==========================================
app.delete('/api/v1/delete/:hash', async (req, res) => {
  const fileHash = req.params.hash;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Falta la cabecera x-user-id' });
  }

  try {
    const response = await axios.delete(`http://metadata-service:3001/api/v1/articles/${fileHash}?owner_id=${userId}`);
    res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    const msg = error.response ? error.response.data.error : 'Error interno del Gateway';
    res.status(status).json({ error: msg });
  }
});


// ==========================================
// NUEVAS RUTAS DE AUTENTICACIÓN Y CONFIG
// ==========================================

// Puente para obtener las categorías
app.get('/api/v1/categories/available', async (req, res) => {
  try {
    // El Gateway le pregunta al Metadata Service (usando el nombre del contenedor interno de Docker)
    const response = await axios.get('http://metadata-service:3001/api/v1/categories/available');
    res.json(response.data);
  } catch (error) {
    console.error("[Gateway] Error obteniendo categorías:", error.message);
    res.status(500).json({ error: "Error de comunicación interna" });
  }
});

// Puente para el registro de usuarios
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    // El Gateway reenvía los datos del formulario al Metadata Service
    const response = await axios.post('http://metadata-service:3001/api/v1/auth/register', req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("[Gateway] Error en registro:", error.message);
    // Reenviamos el error exacto que nos dio el Metadata
    const status = error.response ? error.response.status : 500;
    const data = error.response ? error.response.data : { error: "Error de comunicación interna" };
    res.status(status).json(data);
  }
});

// Puente para el inicio de sesión 
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const response = await axios.post('http://metadata-service:3001/api/v1/auth/login', req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    res.status(status).json(error.response?.data || { error: "Error de comunicación interna" });
  }
});

// Puente para obtener el árbol de categorías del usuario
app.get('/api/v1/themes/user/:id', async (req, res) => {
  try {
    const response = await axios.get(`http://metadata-service:3001/api/v1/themes/user/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    res.status(status).json({ error: "Error de comunicación interna" });
  }
});

// Puente para obtener los archivos del usuario
app.get('/api/v1/files/user/:id', async (req, res) => {
  try {
    const response = await axios.get(`http://metadata-service:3001/api/v1/files/user/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    res.status(status).json({ error: "Error de comunicación interna" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API Gateway escuchando en puerto ${PORT}`));