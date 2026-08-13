# The web app, for local development.
#
# Built from the repository root, not from frontend/: the lockfile and the
# workspace definition live there, and `npm ci` needs both to install the same
# versions everyone else has.
FROM node:20-slim

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Manifests first, so editing a component does not reinstall the world.
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
RUN npm ci

COPY . .

# -H 0.0.0.0 so the port is reachable from outside the container; the default
# binding would only answer to the container itself.
CMD ["npm", "run", "dev", "--workspace", "frontend", "--", "-H", "0.0.0.0"]
