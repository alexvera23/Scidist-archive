# Usamos una imagen ligera de Node.js
FROM node:18-alpine

# Creamos el directorio de trabajo
WORKDIR /app

# Copiamos los archivos de dependencias primero para aprovechar el cache de Docker
COPY package*.json ./

# Instalamos las dependencias
RUN npm install --production

# Copiamos el resto del código (server.js, models.js, .env)
COPY . .

# Exponemos el puerto que definimos en el .env
EXPOSE 3001

# Comando para arrancar el servicio
CMD ["node", "server.js"]