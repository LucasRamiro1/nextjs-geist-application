# Etapa de build
FROM node:18 AS builder
WORKDIR /app

COPY package*.json ./ 
COPY tsconfig.json ./ 
RUN npm install

COPY . .

RUN npm run build

# Etapa final
FROM node:18
WORKDIR /usr/src/app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN npm install --production

CMD ["node", "dist/src/index.js"]

