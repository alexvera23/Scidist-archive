const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const axios = require('axios');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const app = express();
app.use(express.json());

const PROTO_PATH = path.join(__dirname, 'proto', 'storage.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const storageProto = grpc.loadPackageDefinition(packageDefinition).storage;

const upload = multer({ dest: 'temp_uploads/' });

// =====================================================================
// FIX PROBLEMA 2 (parte C): fetchActiveNodes ahora usa /nodes/active,
// que cruza ActiveNode + NodeHealth. Solo devuelve nodos con latido
// reciente. El nodo primario caído ya no aparecerá en esta lista,
// y el hash-routing apuntará a otro nodo vivo automáticamente.
// =====================================================================
async function fetchActiveNodes() {
  try {
    const response = await axios.get('http://metadata-service:3001/api/v1/nodes/active');
    return response.data;
  } catch (error) {
    console.error('[Gateway] No se pudo obtener la lista de nodos activos');
    return [];
  }
}

/**
 * Lógica de Anillo (Ring Logic) para Factor de Replicación 3.
 * Al trabajar solo con nodos vivos, si el primario original cayó
 * el anillo recalcula un nuevo primario entre los supervivientes.
 */
function getRoutingNodes(fileHash, activeNodes) {
  if (activeNodes.length === 0) return null;

  const hashInt = parseInt(fileHash.substring(0, 8), 16);
  const primaryIndex = hashInt % activeNodes.length;

  const replica1Index = (primaryIndex + 1) % activeNodes.length;
  const replica2Index = (primaryIndex + 2) % activeNodes.length;

  return {
    primary: activeNodes[primaryIndex],
    replicas: [activeNodes[replica1Index], activeNodes[replica2Index]]
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: SUBIR ARCHIVO
// ─────────────────────────────────────────────────────────────────────────────
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

    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const fileHash = hashSum.digest('hex');

    let extractedText = '';
    try {
      if (extension === '.pdf') {
        const uint8Array = new Uint8Array(fileBuffer);
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdfDocument = await loadingTask.promise;
        const numPages = Math.min(3, pdfDocument.numPages);
        let fullText = '';

        for (let i = 1; i <= numPages; i++) {
          const page = await pdfDocument.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + ' ';
        }
        extractedText = fullText.replace(/\s+/g, ' ').substring(0, 2500);
      } else if (extension === '.txt') {
        extractedText = fileBuffer.toString('utf-8').substring(0, 2500);
      }
    } catch (parseError) {
      console.error('[Gateway] Advertencia: No se pudo extraer texto para la IA:', parseError.message);
    }

    let candidateLabels = [];
    let categoryMap = {};
    let generalThemeId = null;

    try {
      const catResponse = await axios.get(`http://metadata-service:3001/api/v1/users/${userId}/categories`);
      const { themes, subthemes } = catResponse.data;

      themes.forEach(t => {
        if (t.name.toLowerCase() === 'general') {
          generalThemeId = t._id;
        } else {
          candidateLabels.push(t.name);
          categoryMap[t.name] = { theme_id: t._id, subtheme_id: null };
        }
      });

      subthemes.forEach(st => {
        candidateLabels.push(st.name);
        categoryMap[st.name] = { theme_id: st.parent_theme_id, subtheme_id: st._id };
      });
    } catch (catError) {
      console.error('[Gateway] Error obteniendo categorías:', catError.message);
    }

    let finalThemeId = generalThemeId;
    let finalSubthemeId = null;

    if (extractedText.trim().length > 50 && candidateLabels.length > 0) {
      try {
        const validationLabels = ['artículo científico (IMRyD)', 'documento genérico', 'publicidad o spam'];
        const validationResponse = await axios.post('http://classifier-service:8000/classify', {
          text: extractedText,
          candidate_labels: validationLabels
        });

        const isValid = validationResponse.data.best_label === 'artículo científico (IMRyD)';
        const validationConfidence = validationResponse.data.confidence;

        if (!isValid || validationConfidence < 0.4) {
          console.log(`[Gateway] Archivo rechazado: No parece un artículo científico (${(validationConfidence * 100).toFixed(1)}%)`);
          fs.unlinkSync(tempPath);
          return res.status(400).json({
            error: 'El archivo no cumple con la estructura de un artículo científico (IMRyD).'
          });
        }

        const aiResponse = await axios.post('http://classifier-service:8000/classify', {
          text: extractedText,
          candidate_labels: candidateLabels
        });

        const { best_label, confidence } = aiResponse.data;
        if (confidence > 0.3) {
          finalThemeId = categoryMap[best_label].theme_id;
          finalSubthemeId = categoryMap[best_label].subtheme_id;
          console.log(`[IA] Clasificado en: ${best_label} (${(confidence * 100).toFixed(1)}%)`);
        }
      } catch (aiError) {
        console.error('[Gateway] Error en validación IA:', aiError.message);
      }
    }

    // fetchActiveNodes ya filtra por salud — solo nodos con latido reciente
    const activeNodes = await fetchActiveNodes();
    if (activeNodes.length === 0) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return res.status(503).json({ error: 'No hay nodos de almacenamiento disponibles en la red' });
    }

    const routing = getRoutingNodes(fileHash, activeNodes);
    if (!routing) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return res.status(503).json({ error: 'No se pudo calcular el enrutamiento' });
    }

    const { primary: targetNode, replicas: replicaNodes } = routing;
    const client = new storageProto.StorageService(targetNode.address, grpc.credentials.createInsecure());

    const call = client.UploadFile(async (error, _response) => {
      fs.unlinkSync(tempPath);

      if (error) {
        return res.status(500).json({ error: 'Error al transferir al nodo de almacenamiento' });
      }

      try {
        const metadataPayload = {
          file_hash: fileHash,
          title: originalName,
          owner_id: userId,
          theme_id: finalThemeId,
          subtheme_id: finalSubthemeId,
          node_id: targetNode.node_id,
          replicas: replicaNodes.map(n => n.node_id)
        };

        await axios.post('http://metadata-service:3001/api/v1/articles', metadataPayload);

        res.status(200).json({
          message: 'Archivo analizado por IA, distribuido y registrado',
          file_hash: fileHash,
          classification: {
            assigned_theme_id: finalThemeId,
            assigned_subtheme_id: finalSubthemeId
          }
        });
      } catch (metadataError) {
        res.status(500).json({ error: 'Fallo el registro en base de datos' });
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Intenta descargar un archivo desde un nodo específico.
//
// Estrategia anti-corrupción: los headers HTTP (Content-Disposition, etc.)
// NO se envían hasta que llega el primer chunk de datos del nodo. Así, si
// el nodo falla antes de enviar nada (timeout, NOT_FOUND, UNAVAILABLE...),
// la Promise resuelve `false` y el caller puede intentar el siguiente nodo
// sin que el cliente haya recibido ningún byte corrupto todavía.
//
// Una vez que el primer chunk llega y se fijan los headers, estamos
// comprometidos con ese nodo: si falla a mitad del stream, cerramos la
// respuesta limpiamente (res.end) — es preferible a mezclar datos de dos
// nodos distintos.
// ─────────────────────────────────────────────────────────────────────────────
function tryDownloadFromNode(node, fileHash, res, title) {
  return new Promise((resolve) => {
    const client = new storageProto.StorageService(
      node.address,
      grpc.credentials.createInsecure()
    );
    const call = client.DownloadFile({ file_hash: fileHash });

    let committed = false; // true en cuanto enviamos el primer byte al cliente

    call.on('data', (response) => {
      if (!committed) {
        // Primer chunk recibido — a partir de aquí no hay vuelta atrás.
        committed = true;
        res.setHeader('Content-Disposition', `attachment; filename="${title}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('X-Served-By-Node', node.node_id);
        res.setHeader('X-Is-Replica', String(!node.is_primary));
      }
      res.write(response.chunk);
    });

    call.on('end', () => {
      if (committed) {
        res.end();
        resolve(true);
      } else {
        // Nodo respondió con stream vacío — tratar como fallo.
        console.warn(`[Gateway] Nodo ${node.node_id} devolvió stream vacío para ${fileHash}.`);
        resolve(false);
      }
    });

    call.on('error', (err) => {
      if (committed) {
        // Ya empezamos a enviar bytes — no podemos reintentar.
        // Cerramos limpiamente para que el cliente al menos sepa que terminó.
        console.error(`[Gateway] Error mid-stream en ${node.node_id}:`, err.message);
        res.end();
        resolve(true); // Resolvemos true para no seguir iterando (ya hubo respuesta parcial).
      } else {
        // Fallo antes de enviar nada — podemos intentar el siguiente nodo.
        console.warn(`[Gateway] Nodo ${node.node_id} no disponible (${err.code || err.message}), probando siguiente réplica...`);
        resolve(false);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: DESCARGAR ARCHIVO (con failover automático entre réplicas)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/v1/download/:hash', async (req, res) => {
  const fileHash = req.params.hash;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Falta la cabecera x-user-id' });
  }

  try {
    // Metadata devuelve candidate_nodes[] ordenados: primario primero, réplicas después.
    const metadataUrl = `http://metadata-service:3001/api/v1/articles/${fileHash}?owner_id=${userId}`;
    const metadataResponse = await axios.get(metadataUrl);
    const { title, candidate_nodes } = metadataResponse.data;

    if (!candidate_nodes || candidate_nodes.length === 0) {
      return res.status(503).json({ error: 'No hay nodos disponibles para este archivo' });
    }

    // Iterar en orden: primario → réplica 1 → réplica 2
    for (const node of candidate_nodes) {
      console.log(`[Gateway] Intentando descarga de ${fileHash} desde ${node.node_id} (${node.is_primary ? 'primario' : 'réplica'})...`);
      const succeeded = await tryDownloadFromNode(node, fileHash, res, title);
      if (succeeded) return; // Descarga completada (o mid-stream cerrada limpiamente).
    }

    // Todos los nodos fallaron antes de enviar cualquier dato.
    if (!res.headersSent) {
      res.status(503).json({
        error: 'Todos los nodos que contienen este archivo están fuera de línea.',
        tried: candidate_nodes.map(n => n.node_id)
      });
    }

  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'El archivo no existe o no te pertenece' });
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno al procesar la descarga' });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: BORRAR ARCHIVO
// ─────────────────────────────────────────────────────────────────────────────
app.delete('/api/v1/delete/:hash', async (req, res) => {
  const fileHash = req.params.hash;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Falta la cabecera x-user-id' });
  }

  try {
    const response = await axios.delete(`http://metadata-service:3001/api/v1/articles/${fileHash}?owner_id=${userId}`);
    res.status(200).json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    const msg = error.response ? error.response.data.error : 'Error interno del Gateway';
    res.status(status).json({ error: msg });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API Gateway escuchando en puerto ${PORT}`));