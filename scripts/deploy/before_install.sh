#!/bin/bash
set -euo pipefail
id app >/dev/null 2>&1 || useradd --system --no-create-home --shell /sbin/nologin app
mkdir -p /opt/app/api /opt/app/bff /opt/app/web /opt/app/config
