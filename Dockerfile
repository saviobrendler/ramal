# Imagem para publicar o Ramal em qualquer serviço que rode contêineres (Render, Railway, Fly.io, VPS).
# Os relatos ficam em /app/data (volume persistente): sem volume, eles se perdem ao reiniciar.
#
#   docker build -t ramal .
#   docker run -p 5173:5173 -v ramal-data:/app/data -e ADMIN_TOKEN=troque-por-um-segredo ramal

FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=5173

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 5173
VOLUME ["/app/data"]
CMD ["node", "server.js"]
