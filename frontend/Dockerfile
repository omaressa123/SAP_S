# Smart Airport dashboard: build with Node, serve production build with nginx.
# VITE_API_URL is baked at build time and MUST be browser-accessible
# (http://localhost:8000), never the Docker-internal http://backend:8000.
ARG VITE_API_URL=http://localhost:8000

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Serve the existing Babylon.js Digital Twin web-client at /twin.
COPY twin-dist /usr/share/nginx/html/twin
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
