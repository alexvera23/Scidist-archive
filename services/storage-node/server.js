const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs-extra');
const path = require('path');


const PROTO_PATH = path.join(__dirname, 'proto', 'storage.proto');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const axios = require('axios');
const METADATA_URL = 'http://metadata-service:3001/api/v1';
const MY_NODE_ID = process.env.NODE_ID || 'local';

fs.ensureDirSync(UPLOADS_DIR);

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const storageProto = grpc.loadPackageDefinition(packageDefinition).storage;

function uploadFile(call, callback) {
  let fileStream = null;
  let currentFileHash = '';

  call.on('data', (payload) => {
    if (payload.info) {
      currentFileHash = payload.info.file_hash;
      const extension = payload.info.extension || '.pdf';
      const filePath = path.join(UPLOADS_DIR, `${currentFileHash}${extension}`);
      fileStream = fs.createWriteStream(filePath);
      console.log(`[Storage]  Iniciando recepción: ${currentFileHash}`);
    } else if (payload.chunk) {
      if (fileStream) fileStream.write(payload.chunk);
    }
  });

  call.on('end', () => {
    if (fileStream) fileStream.end();
    console.log(`[Storage]  Archivo ${currentFileHash} guardado exitosamente.`);
    callback(null, {
      file_hash: currentFileHash,
      success: true,
      message: `Guardado en nodo ${process.env.NODE_ID || 'local'}`
    });
  });

  call.on('error', (err) => {
    console.error(`[Storage]  Error recibiendo archivo:`, err);
    if (fileStream) fileStream.end();
  });
}

// NUEVA FUNCIÓN: Descargar Archivo por Hash
function downloadFile(call) {
  const fileHash = call.request.file_hash;
  console.log(`[Storage] 📤 Solicitud de descarga para: ${fileHash}`);

  // Buscamos cualquier archivo que empiece con este hash (sin importar la extensión)
  const files = fs.readdirSync(UPLOADS_DIR);
  const targetFile = files.find(f => f.startsWith(fileHash));

  if (!targetFile) {
    console.error(`[Storage]  Archivo ${fileHash} no encontrado físicamente`);
    return call.emit('error', { code: grpc.status.NOT_FOUND, details: 'Archivo no encontrado' });
  }

  const filePath = path.join(UPLOADS_DIR, targetFile);
  
  // Creamos un stream de lectura (pedacitos de 64KB)
  const readStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 64 });

  // Cada vez que leemos un pedazo del disco, lo enviamos por gRPC
  readStream.on('data', (chunk) => {
    call.write({ chunk: chunk });
  });

  readStream.on('end', () => {
    console.log(`[Storage]  Descarga gRPC completada para: ${fileHash}`);
    call.end(); // Avisar que terminamos
  });

  readStream.on('error', (err) => {
    console.error(`[Storage]  Error leyendo archivo:`, err);
    call.emit('error', { code: grpc.status.INTERNAL, details: 'Error leyendo disco' });
  });
}

function main() {
  const server = new grpc.Server();
  // AQUÍ REGISTRAMOS LA NUEVA FUNCIÓN
  server.addService(storageProto.StorageService.service, { 
    uploadFile: uploadFile,
    downloadFile: downloadFile 
  });
  
  const port = process.env.PORT || '50051';
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(` Nodo de Almacenamiento [${process.env.NODE_ID || 'local'}] escuchando en puerto ${port}`);
    server.start();
  });
}

async function processReplicationTasks() {
  try {
    // 1. Preguntamos si hay tareas para nosotros
    const response = await axios.get(`${METADATA_URL}/replication-tasks/${MY_NODE_ID}`);
    const tasks = response.data;

    if (tasks.length === 0) return; // Nada que hacer

    console.log(`[P2P Worker]  Encontradas ${tasks.length} tareas de replicación.`);
    

    for (const task of tasks) {
      console.log(`[P2P Worker]  Replicando ${task.file_hash} hacia ${task.target_node}`);
      
      const filePath = path.join(UPLOADS_DIR, `${task.file_hash}.pdf`); // Asumimos PDF por ahora, ELIMINAR linea si queremos replicar cualquier tipo de archivos
      // const files = fs.readdirSync(UPLOADS_DIR);
      // const targetFile = files.find(f=> f.startsWith(task.file_hash)); Descomentar en caso de replicar cualquier tipo de archivos
      if (!fs.existsSync(filePath)) {
        console.error(`[const filePP2P Worker] Archivo no encontrado en disco: ${filePath}`);
        continue; // Pasamos a la siguiente tarea
      }
      // Descomentar en caso de replicar cualquier tipo de archivos
      // const filePath = path.join(UPLOADS_DIR, targetFile);
      // const fileExtension = path.extname(targetFile);

      // 2. Nos conectamos al nodo vecino como si fuéramos un cliente (Gateway)
      const targetAddress = `${task.target_node}:50051`;
      const client = new storageProto.StorageService(targetAddress, grpc.credentials.createInsecure());

      const call = client.UploadFile(async (error, response) => {
        if (error) {
          console.error(`[P2P Worker]  Error enviando a ${task.target_node}:`, error.message);
          return;
        }
        
        // 3. Si se copió con éxito, avisamos a la base de datos
        console.log(`[P2P Worker]  Copia exitosa en ${task.target_node}. Notificando a BD...`);
        try {
          await axios.post(`${METADATA_URL}/replication-tasks/complete`, {
            task_id: task._id,
            file_hash: task.file_hash,
            target_node: task.target_node
          });
        } catch (dbErr) {
          console.error(`[P2P Worker] Error actualizando estado en BD:`, dbErr.message);
        }
      });

      // Enviamos el stream por gRPC
      call.write({ info: { file_hash: task.file_hash, extension: '.pdf' } });
      const readStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 64 });
      
      readStream.on('data', (chunk) => call.write({ chunk: chunk }));
      readStream.on('end', () => call.end());
    }
  } catch (error) {
    console.error('[P2P Worker] Error contactando al Metadata Service');
  }
}

// Arrancar el worker 5 segundos después de que inicie el nodo, y luego cada 15 segundos
setTimeout(() => {
  console.log(`[P2P Worker]  Iniciando vigilante de replicación en ${MY_NODE_ID}`);
  setInterval(processReplicationTasks, 15000);
}, 5000);

main();