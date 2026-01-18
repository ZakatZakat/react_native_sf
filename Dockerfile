FROM node:23-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci

FROM node:23-alpine AS dev

WORKDIR /app
ENV NODE_ENV=development

COPY --from=deps /app/node_modules ./node_modules

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM node:23-alpine AS build

WORKDIR /app

ENV NODE_ENV=production
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npm run build

FROM nginx:alpine AS runner

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]



