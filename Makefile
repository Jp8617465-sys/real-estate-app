.PHONY: setup run check check-factory generate-client prototype

PG_BIN := $(shell brew --prefix postgresql@17 2>/dev/null)/bin
export PATH := $(PG_BIN):$(PATH)

# One-off, repeatable: pinned dependencies, local PostgreSQL 17, database, migrations, built front end.
setup:
	@pg_isready -q || brew services start postgresql@17
	@for i in 1 2 3 4 5 6 7 8 9 10; do pg_isready -q && break; sleep 1; done; pg_isready -q
	cd api && uv sync --frozen
	cd api && uv run python -m buyers_desk.provision
	cd web && npm ci
	cd web && npm run build

# The whole app on http://127.0.0.1:8000 (API and built front end). Run `make setup` first.
run:
	cd web && npm run build
	cd api && uv run python -m buyers_desk.provision
	cd api && uv run uvicorn buyers_desk.app:create_app --factory --host 127.0.0.1 --port 8000

check: check-factory
	cd api && uv run mypy
	cd api && uv run pytest -q
	python3 scripts/check_api_client.py
	cd web && npm run build

check-factory:
	python3 scripts/upstream_skills.py verify
	python3 scripts/check_factory.py

# After changing the API: refresh the OpenAPI document and the typed client generated from it.
generate-client:
	cd api && uv run python -m buyers_desk.openapi > ../web/openapi.json
	cd web && npm run generate

# Working hybrid. Open http://127.0.0.1:8765/buyers-desk-hybrid.html
prototype:
	python3 -m http.server 8765 --bind 127.0.0.1 --directory prototypes
