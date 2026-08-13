# The API, for local development.
#
# Dependencies are installed into the image's own site-packages rather than a
# .venv. The source is bind-mounted over /app at run time, and a .venv living
# there would be hidden by the mount — this way the packages are somewhere the
# mount cannot reach.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# curl is the healthcheck; the rest is what asyncpg and argon2 build against.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

# Dependencies first, so editing a source file does not reinstall them. The
# package is installed editable, so it needs enough of the tree to be built.
COPY pyproject.toml ./
COPY app ./app
RUN uv pip install --system --no-cache -e ".[dev]"

COPY . .

ENTRYPOINT ["/app/docker-entrypoint.sh"]
