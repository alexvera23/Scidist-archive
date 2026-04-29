const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const dgram = require('dgram');

const PROTO_PATH = path.join(__dirname, 'proto', 'storage.proto');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const METADATA_URL = 'http://metadata-service:3001/api/v1';

const MY_NODE_ID = process.env.NODE_ID;
// El puerto por defecto si no viene en las variables de entorno
const PORT = process.env.PORT || '50051'; 
const MY_ADDRESS = `${MY_NODE_ID}:${PORT}`;

const udpClient = dgram.createSocket('udp4');
const METADATA_UDP_PORT = 3002;
const METADATA_HOST = 'metadata-service';

fs.ensureDirSync(UPLOADS_DIR);

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const storageProto = grpc.loadPackageDefinition(packageDefinition).storage;

// 1. Función para registrarse dinámicamente en el Metadata Service
async function registerSelf() {
  try {
    await axios.post(`${METADATA_URL}/nodes/register`, { // <-- Asegúrate de que la ruta coincida con el Gateway
      node_id: MY_NODE_ID,
      address: MY_ADDRESS
    });
    console.log(`[${MY_NODE_ID}]  Auto-registro exitoso en el Metadata Service`);
  } catch (error) {
    console.error(`[${MY_NODE_ID}]  Fallo al registrarse. Reintentando en 5s...`);
    setTimeout(registerSelf, 5000);
  }
}

// 2. Funciones de gRPC
function uploadFile(call, callback) {
  let fileStream = null;
  let currentFileHash = '';

  call.on('data', (payload) => {
    if (payload.info) {
      currentFileHash = payload.info.file_hash;
      const extension = payload.info.extension || '.pdf';
      const filePath = path.join(UPLOADS_DIR, `${currentFileHash}${extension}`);
      fileStream = fs.createWriteStream(filePath);
      console.log(`[Storage] Iniciando recepción: ${currentFileHash}`);
    } else if (payload.chunk) {
      if (fileStream) fileStream.write(payload.chunk);
    }
  });

  call.on('end', () => {
    if (fileStream) fileStream.end();
    console.log(`[Storage] Archivo ${currentFileHash} guardado exitosamente.`);
    callback(null, {
      file_hash: currentFileHash,
      success: true,
      message: `Guardado en nodo ${process.env.NODE_ID || 'local'}`
    });
  });

  call.on('error', (err) => {
    console.error(`[Storage] Error recibiendo archivo:`, err);
    if (fileStream) fileStream.end();
  });
}

function downloadFile(call) {
  const fileHash = call.request.file_hash;
  console.log(`[Storage] Solicitud de descarga para: ${fileHash}`);

  const files = fs.readdirSync(UPLOADS_DIR);
  const targetFile = files.find(f => f.startsWith(fileHash));

  if (!targetFile) {
    console.error(`[Storage] Archivo ${fileHash} no encontrado físicamente`);
    return call.emit('error', { code: grpc.status.NOT_FOUND, details: 'Archivo no encontrado' });
  }

  const filePath = path.join(UPLOADS_DIR, targetFile);
  const readStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 64 });

  readStream.on('data', (chunk) => {
    call.write({ chunk: chunk });
  });

  readStream.on('end', () => {
    console.log(`[Storage] Descarga gRPC completada para: ${fileHash}`);
    call.end();
  });

  readStream.on('error', (err) => {
    console.error(`[Storage] Error leyendo archivo:`, err);
    call.emit('error', { code: grpc.status.INTERNAL, details: 'Error leyendo disco' });
  });
}

// 3. Worker de Replicación P2P (Replicar y Borrar archivos)
async function processReplicationTasks() {
  try {
    const response = await axios.get(`${METADATA_URL}/replication-tasks/${MY_NODE_ID}`);
    const tasks = response.data;

    if (tasks.length === 0) return;

    for (const task of tasks) {
      const filePath = path.join(UPLOADS_DIR, `${task.file_hash}.pdf`);

      // ========================================
      // NUEVA LÓGICA: SI ES ORDEN DE BORRADO
      // ========================================
      if (task.task_type === 'DELETE') {
        console.log(`[P2P Worker] ⚠️ ORDEN DE BORRADO: ${task.file_hash}`);

        //  FIX: Buscar el archivo sin asumir la extensión, igual que hace downloadFile
        const files = fs.readdirSync(UPLOADS_DIR);
        const targetFileName = files.find(f => f.startsWith(task.file_hash));

        if (targetFileName) {
          const filePath = path.join(UPLOADS_DIR, targetFileName);
          fs.unlinkSync(filePath);
          console.log(`[P2P Worker]  Archivo ${targetFileName} borrado del disco físico.`);
        } else {
          console.log(`[P2P Worker] El archivo ${task.file_hash} ya no estaba en el disco.`);
        }

        try {
          await axios.post(`${METADATA_URL}/replication-tasks/complete`, {
            task_id: task._id,
            file_hash: task.file_hash,
            task_type: 'DELETE'
          });
          console.log(`[P2P Worker]  Borrado notificado al Metadata Service.`);
        } catch (dbErr) {
          console.error(`[P2P Worker]  Error notificando borrado:`, dbErr.message);
        }
        continue;
      }
      // ========================================
      // LÓGICA ORIGINAL: REPLICACIÓN
      // ========================================
      console.log(`[P2P Worker] Replicando ${task.file_hash} hacia ${task.target_node}`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`[P2P Worker] Archivo no encontrado para replicar: ${filePath}`);
        continue;
      }

      // Conectarse dinámicamente usando la lista del registro si es necesario, 
      // o usar el formato estático si asumes el puerto 50051
      const targetAddress = `${task.target_node}:50051`;
      const client = new storageProto.StorageService(targetAddress, grpc.credentials.createInsecure());

      const call = client.UploadFile(async (error, response) => {
        if (error) {
          console.error(`[P2P Worker] Error enviando a ${task.target_node}:`, error.message);
          return;
        }
        console.log(`[P2P Worker] Copia exitosa en ${task.target_node}.`);
        try {
          await axios.post(`${METADATA_URL}/replication-tasks/complete`, {
            task_id: task._id,
            file_hash: task.file_hash,
            task_type: 'REPLICATE' // <--- Pasarlo de vuelta
          });
        } catch (dbErr) {
          console.error(`[P2P Worker] Error actualizando estado en BD:`, dbErr.message);
        }
      });

      call.write({ info: { file_hash: task.file_hash, extension: '.pdf' } });
      const readStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 64 });
      
      readStream.on('data', (chunk) => call.write({ chunk: chunk }));
      readStream.on('end', () => call.end());
    }
  } catch (error) {
    // Silenciado para no llenar los logs, o puedes dejar el console.error
  }
}

// 4. Latidos UDP (Salud)
function sendHearbeat(){
  const payload = Buffer.from(JSON.stringify({
    node_id: MY_NODE_ID,
    status: 'up',
    timestamp: Date.now()
  }));

  udpClient.send(payload, 0, payload.length, METADATA_UDP_PORT, METADATA_HOST, (err) => {
    if (err) console.error(`[Heartbeat] Error enviando latido:`, err.message);
  });
}

// 5. Función Principal (Arranque)
function main() {
  const server = new grpc.Server();
  
  server.addService(storageProto.StorageService.service, { 
    UploadFile: uploadFile,    // A veces Protobuf espera mayúsculas, lo dejamos como en tu proto
    DownloadFile: downloadFile 
  });
  
  server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error(`Error al hacer bind al puerto:`, err);
      return;
    }
    server.start();
    console.log(` Storage Node [${MY_NODE_ID}] escuchando en puerto ${boundPort}`);
    
    // AQUÍ ES DONDE DEBE IR EL REGISTRO
    registerSelf();
  });
}

// Iniciar procesos en segundo plano
setInterval(sendHearbeat, 5000);

setTimeout(() => {
  console.log(`[P2P Worker] Iniciando vigilante de replicación en ${MY_NODE_ID}`);
  setInterval(processReplicationTasks, 15000);
}, 5000);

// Arrancar servidor gRPC
main();