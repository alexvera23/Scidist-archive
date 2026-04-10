FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

# Copiamos el código del servidor
COPY . .

# La copia de la carpeta proto y uploads se hará desde el contexto del docker-compose
# por eso no copiamos "." directamente

EXPOSE 50051

CMD ["node", "server.js"]