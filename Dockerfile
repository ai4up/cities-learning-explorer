# ---------- Build Stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production=false

COPY . .
ARG VITE_PLAUSIBLE_DOMAIN=""
ARG VITE_PLAUSIBLE_SCRIPT_SRC=""
ENV VITE_PLAUSIBLE_DOMAIN=${VITE_PLAUSIBLE_DOMAIN}
ENV VITE_PLAUSIBLE_SCRIPT_SRC=${VITE_PLAUSIBLE_SCRIPT_SRC}
RUN npm run build

# ---------- Production Stage ----------
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Remove default nginx static files
RUN rm -rf ./*

# Copy React build output
COPY --from=builder /app/dist .

# Copy custom nginx config for client-side routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
