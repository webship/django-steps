#!/usr/bin/env bash
# Builds the Django site the suite runs against: a plain project made with
# `django-admin startproject`, plus the polls app of the official tutorial,
# registered in the admin with the features most projects use, in a DDEV
# project. DDEV has no project type for Django, so the project is a generic one:
#
#   - Python in the web image: uv, and the Python release the site runs on
#     (.ddev/web-build/Dockerfile.django); the packages in a virtual
#     environment of the project (.venv/);
#   - the site served by the web container as a daemon (manage.py runserver),
#     and the router sending the project's address to its port
#     (.ddev/config.django.yaml);
#   - PostgreSQL 16 from DDEV, the container's own db / db / db;
#   - DEBUG off, as in production (a missing page is the 404 page, a refusal the
#     403 page); the server runs with --insecure, which keeps it serving the
#     static files;
#   - the sample data of the polls app: 5 categories, 4 tags, 24 questions with
#     their choices (site/django-site.py seed).
#
# Settings (environment variables, all optional):
#   PROJECT_NAME      the DDEV project name                     (default djangosteps)
#   SITE_DIR          the project folder                        (default a new temporary folder)
#   DJANGO_VERSION    a release line (6.1, 5.2) or a release    (default 6.1, the current stable line)
#   PYTHON_VERSION    the Python of the site                    (default 3.13)
#   ACCOUNT_PASSWORD  the password of the accounts below        (default dD.123123ddd)
#   ACCOUNTS_ONLY     1: build nothing, give the accounts of the site in SITE_DIR
#                     back their password, address, staff status and group (after
#                     a run that was stopped half way)
#
# The accounts are configuration: this script creates them and cucumber.js names
# them; the features never create or delete one.
#   administrator  administrator@example.com  a superuser
#   editor         editor@example.com         staff, in the group Editors: adds, changes, deletes and views the polls
#   viewer         viewer@example.com         staff, in the group Viewers: views the polls, nothing else
#
# Nothing is installed that Django and its PostgreSQL driver do not need: no
# paid service, no account anywhere.
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-djangosteps}"
DJANGO_VERSION="${DJANGO_VERSION:-6.1}"
PYTHON_VERSION="${PYTHON_VERSION:-3.13}"
ACCOUNT_PASSWORD="${ACCOUNT_PASSWORD:-dD.123123ddd}"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"
SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../site" && pwd)/django-site.py"
ROOT=/var/www/html

# The pip requirement of a release line (two numbers) or of one release (three).
case "$DJANGO_VERSION" in
  *.*.*) REQUIREMENT="Django==${DJANGO_VERSION}" ;;
  *.*) REQUIREMENT="Django~=${DJANGO_VERSION}.0" ;;
  *) echo "DJANGO_VERSION is a release line (6.1) or a release (6.1.3), not ${DJANGO_VERSION}." >&2; exit 1 ;;
esac

# django-site.py with the site's Python, in the folder of manage.py; the accounts
# travel as base64 of a JSON object.
site_script() {
  local accounts
  accounts="$(ACCOUNT_PASSWORD="$ACCOUNT_PASSWORD" python3 -c '
import base64, json, os
p = os.environ["ACCOUNT_PASSWORD"]
print(base64.b64encode(json.dumps({"accounts": [
    {"name": "administrator", "email": "administrator@example.com", "password": p, "role": "superuser"},
    {"name": "editor", "email": "editor@example.com", "password": p, "role": "editor"},
    {"name": "viewer", "email": "viewer@example.com", "password": p, "role": "viewer"},
]}).encode()).decode())')"
  ddev exec -d "$ROOT/mysite" "DJANGO_SITE_ACCOUNTS=${accounts} $ROOT/.venv/bin/python - $*" < "$SCRIPT"
}

manage() {
  ddev exec -d "$ROOT/mysite" "$ROOT/.venv/bin/python manage.py $*" < /dev/null
}

mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

if [ "${ACCOUNTS_ONLY:-}" = "1" ]; then
  site_script accounts add
  exit 0
fi

# A generic project: no web server of DDEV's own, the database PostgreSQL 16,
# Node.js 24 (the line of the Webship Workspace; the site itself needs none).
ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name="$PROJECT_NAME" \
  --database=postgres:16 --nodejs-version=24

mkdir -p .ddev/web-build
cat > .ddev/config.django.yaml <<YAMLEOF
# The Django site of this project. The web container serves no files of its own:
# the router sends ports 80 and 443 of the project's address to the Django server,
# which the web container runs as a daemon once the build has finished.
web_extra_exposed_ports:
  - name: django
    container_port: 8000
    http_port: 80
    https_port: 443
web_extra_daemons:
  - name: django
    command: "bash -c 'while [ ! -f ${ROOT}/mysite/.ready ]; do sleep 2; done; cd ${ROOT}/mysite && exec ${ROOT}/.venv/bin/python manage.py runserver --insecure 0.0.0.0:8000'"
    directory: ${ROOT}
web_environment:
  - PYTHONUNBUFFERED=1
YAMLEOF
cat > .ddev/web-build/Dockerfile.django <<'DOCKEREOF'
# Python for the Django site, in the web image: uv (a release of 2026-11-03), and
# the Python the site runs on, installed by uv. The image's own Python is too old
# for the current Django line on some releases of the container tool.
ENV UV_PYTHON_INSTALL_DIR=/opt/python
# The packages are copied into the project's virtual environment (the cache is on another file system).
ENV UV_LINK_MODE=copy
RUN arch="$(uname -m)" \
    && curl -sSfL "https://github.com/astral-sh/uv/releases/download/0.13.7/uv-${arch}-unknown-linux-gnu.tar.gz" \
       | tar -xz --strip-components=1 -C /usr/local/bin \
    && uv python install 3.13 \
    && chmod -R a+rX /opt/python
DOCKEREOF
if [ "$PYTHON_VERSION" != "3.13" ]; then
  sed -i "s/uv python install 3.13/uv python install ${PYTHON_VERSION}/" .ddev/web-build/Dockerfile.django
fi

ddev start -y

# The packages, in a virtual environment of the project.
ddev exec "uv venv --clear --seed --python ${PYTHON_VERSION} ${ROOT}/.venv && uv pip install --python ${ROOT}/.venv/bin/python '${REQUIREMENT}' 'psycopg[binary]'" < /dev/null

# A plain project, as the tutorial makes it, then what this suite adds.
ddev exec "rm -rf ${ROOT}/mysite && ${ROOT}/.venv/bin/django-admin startproject mysite" < /dev/null
site_script settings
site_script polls
manage makemigrations polls
manage migrate --noinput
site_script accounts add
site_script seed

# The server starts once the site is in place.
ddev exec "touch ${ROOT}/mysite/.ready" < /dev/null
ddev exec "supervisorctl restart webextradaemons:django" < /dev/null
for attempt in $(seq 1 60); do
  code="$(ddev exec "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/admin/login/" < /dev/null 2>/dev/null | tr -d '\r' || true)"
  [ "$code" = "200" ] && break
  sleep 2
done
if [ "$code" != "200" ]; then
  echo "The Django server did not answer; the end of its log:" >&2
  ddev exec "supervisorctl tail webextradaemons:django stderr" < /dev/null >&2 || true
  exit 1
fi

SITE_URL="$(ddev describe -j | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['primary_url'])")"
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
VERSION="$(ddev exec "${ROOT}/.venv/bin/python -c 'import django; print(django.get_version())'" < /dev/null | tr -d '\r')"
echo "Built the Django ${VERSION} site at $SITE_URL"
