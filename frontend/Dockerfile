# syntax=docker/dockerfile:1

# Build stage: produce the static SPA bundle. Vite resolves
# import.meta.env at build time, so the API URL and Google client id
# must be passed in as build args (the workflow plumbs them from
# GitHub secrets).
FROM node:23-alpine AS build
WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build

# Runtime stage: nginx serving the static bundle. SPA routing is
# handled by the included nginx.conf (try_files falls back to
# index.html so client-side routes work on a hard refresh).
FROM nginx:1.27-alpine
COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
