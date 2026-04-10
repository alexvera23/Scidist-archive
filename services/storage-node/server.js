const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs-extra');
const path = require('path');

// En Docker, el volumen se montará en /app/proto
const PROTO_PATH = path.join(__dirname, 'proto', 'storage.proto'); 
const UPLOADS_DIR = path.join(__dirname, 'uploads')

// Asegurarse de que el directorio de subidas exista
fs.ensureDirSync(UPLOADS_DIR);

// Cargar el contrato gRPC
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const storageProto = grpc.loadPackageDefinition(packageDefinition).storage;

/**
 * Implementación del servicio UploadFile
 * Utiliza Streams de gRPC para recibir archivos en fragmentos (chunks)
 */
function uploadFile(call, callback) {
  let fileStream = null;
  let currentFileHash = '';

  // Escuchar cuando llegan datos (chunks)
  call.on('data', (payload) => {
    // Si el payload contiene 'info', es el primer mensaje
    if (payload.info) {
      currentFileHash = payload.info.file_hash;
      const extension = payload.info.extension || '.pdf';
      const filePath = path.join(UPLOADS_DIR, `${currentFileHash}${extension}`);
      
      // Abrir el stream de escritura en el disco
      fileStream = fs.createWriteStream(filePath);
      console.log(`[Storage]  Iniciando recepción: ${currentFileHash}`);
    } 
    // Si el payload contiene 'chunk', son los bytes del archivo
    else if (payload.chunk) {
      if (fileStream) {
        fileStream.write(payload.chunk);
      }
    }
  });

  // Cuando el Gateway avisa que terminó de enviar el archivo
  call.on('end', () => {
    if (fileStream) {
      fileStream.end(); // Cerrar el archivo
    }
    
    console.log(`[Storage]  Archivo ${currentFileHash} guardado exitosamente.`);
    
    // Responder al Gateway que todo salió bien
    callback(null, {
      file_hash: currentFileHash,
      success: true,
      message: `Guardado en nodo ${process.env.NODE_ID || 'local'}`
    });
  });

  // Si ocurre un error de red o en la escritura
  call.on('error', (err) => {
    console.error(`[Storage]  Error recibiendo archivo:`, err);
    if (fileStream) fileStream.end();
  });
}

function main() {
  const server = new grpc.Server();
  server.addService(storageProto.StorageService.service, { 
    uploadFile: uploadFile 
  });
  
  const port = process.env.PORT || '50051';
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(` Nodo de Almacenamiento [${process.env.NODE_ID || 'local'}] escuchando en puerto ${port}`);
    server.start();
  });
}

main();