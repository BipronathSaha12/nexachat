.DEFAULT_GOAL := help
VENV := .venv
PY   := $(VENV)/bin/python
PORT ?= 8000

.PHONY: help venv install migrate migrations run shell superuser test cover lint fmt check schema clean smoke

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

venv:  ## Create the virtualenv
	python3 -m venv $(VENV)

install: venv  ## Install development dependencies
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -r requirements/dev.txt

migrations:  ## Generate migrations
	$(PY) manage.py makemigrations

migrate:  ## Apply migrations
	$(PY) manage.py migrate

run:  ## Run the ASGI dev server (streaming needs ASGI)
	$(VENV)/bin/uvicorn config.asgi:application --host 127.0.0.1 --port $(PORT) --reload

shell:  ## Django shell
	$(PY) manage.py shell

superuser:  ## Create an admin user
	$(PY) manage.py createsuperuser

test:  ## Run the test suite
	$(PY) -m pytest tests/ -q

cover:  ## Run tests with a coverage gate
	$(PY) -m pytest tests/ -q --cov

integration:  ## Run tests that call the real Gemini API
	$(PY) -m pytest tests/ -q -m integration --no-cov

lint:  ## Lint
	$(VENV)/bin/ruff check .

fmt:  ## Auto-fix lint and format
	$(VENV)/bin/ruff check --fix .
	$(VENV)/bin/ruff format .

check:  ## Django system checks, including deployment checks
	$(PY) manage.py check
	$(PY) manage.py check --deploy --settings=config.settings.prod

schema:  ## Write the OpenAPI schema to openapi.yaml
	$(PY) manage.py spectacular --file openapi.yaml

clean:  ## Remove build and test artefacts
	find . -name '__pycache__' -prune -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache .ruff_cache .coverage htmlcov staticfiles
