FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

# Crear carpeta temporal para multer
RUN mkdir -p temp_uploads

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]