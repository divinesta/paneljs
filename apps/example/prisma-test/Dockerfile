FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY packages ./packages
COPY apps/example/prisma-test ./apps/example/prisma-test
COPY apps/web/package.json ./apps/web/package.json
COPY apps/docs/package.json ./apps/docs/package.json

RUN pnpm install --frozen-lockfile
RUN pnpm --filter paneljs build

WORKDIR /app/apps/example/prisma-test
ENV DATABASE_URL="postgresql://postgres:postgres@postgres:5432/paneljs_example"
RUN pnpm exec prisma generate
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

CMD ["./entrypoint.sh"]
