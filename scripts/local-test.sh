#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../app/backend"
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
ruff check .
pytest --cov=. --cov-report=term-missing
