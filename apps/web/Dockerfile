FROM node:22-alpine AS dependencies

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @vibe-coding-starter-kit/web build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --chown=node:node --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/apps/web ./apps/web
COPY --chown=node:node --from=builder /app/packages/shared ./packages/shared

USER node
EXPOSE 3000
CMD ["node", "apps/web/node_modules/next/dist/bin/next", "start", "apps/web", "--hostname", "0.0.0.0", "--port", "3000"]
