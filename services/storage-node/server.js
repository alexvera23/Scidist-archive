const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs-extra');
const path = require('path');

const PROTO_PATH = path.join(__dirname, 'proto', 'storage.proto');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

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

main();