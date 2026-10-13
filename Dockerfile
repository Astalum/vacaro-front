# syntax=docker/dockerfile:1

FROM node:24-alpine AS development-dependencies-env
ARG LOCAL_UID=1000
ARG LOCAL_GID=1000
COPY . /app
WORKDIR /app
RUN npm ci \
	&& chown -R "${LOCAL_UID}:${LOCAL_GID}" /app/node_modules

FROM node:24-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:24-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:24-alpine AS production

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000

WORKDIR /app
COPY --chown=node:node ./package.json package-lock.json ./
COPY --chown=node:node --from=production-dependencies-env /app/node_modules ./node_modules
COPY --chown=node:node --from=build-env /app/build ./build

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD wget --quiet --spider "http://127.0.0.1:${PORT}/" || exit 1

CMD ["npm", "run", "start"]
