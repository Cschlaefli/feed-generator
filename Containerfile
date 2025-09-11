# syntax=docker/dockerfile:1.7
ARG NODE_ENV=production
ARG NODE_VERSION=current

FROM node:$NODE_VERSION-alpine as base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

VOLUME [ "/pnpm-store", "/app/node_modules" ]
RUN pnpm config --global set store-dir /pnpm-store

# dev deps
FROM base as deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# prod-only deps
FROM base as prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

# build app
FROM base as builder
WORKDIR /app
COPY . .

# unsure if needed
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# use dev dependencies for build
COPY --from=deps /app/node_modules ./node_modules
# for private env variable typechecks
COPY .env.example .env 
RUN pnpm run build

# final build
FROM base AS release
WORKDIR /app

# unsure if needed
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

COPY --from=builder /app/dist ./dist

COPY --from=prod-deps /app/package.json .
COPY --from=prod-deps /app/node_modules ./node_modules

EXPOSE 3000

# Specify the command to run when the container starts
CMD ["node", "dist"]
