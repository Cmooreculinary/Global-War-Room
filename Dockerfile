# One process for the API and the built React app.
# Coolify, Cloud Run, and Hugging Face Spaces can all run this image.
# Set MONGO_URL, DB_NAME, and ANTHROPIC_API_KEY in the host, not in the image.

FROM node:22-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN corepack enable && corepack prepare yarn@1.22.22 --activate \
    && yarn install --frozen-lockfile
COPY frontend/ ./
ENV REACT_APP_BACKEND_URL=
ENV CI=false
ENV GENERATE_SOURCEMAP=false
RUN yarn build

FROM python:3.12-slim-bookworm
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc g++ \
    && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt /tmp/requirements.txt
# Dev-only tools stay out of the runtime image.
RUN grep -vE '^(pytest|black|isort|flake8|mypy)([=<>]|$)' /tmp/requirements.txt > /tmp/req.txt \
    && pip install --no-cache-dir -r /tmp/req.txt \
    && rm -rf /var/lib/apt/lists/*
COPY backend /app/backend
COPY --from=frontend /src/frontend/build /app/frontend/build
WORKDIR /app/backend
ENV PORT=7860
EXPOSE 7860
CMD ["sh", "-c", "uvicorn serve_gwr:app --host 0.0.0.0 --port ${PORT:-7860}"]
