#!/bin/bash
set -euo pipefail
systemctl enable catalog-api.service catalog-bff.service nginx.service
systemctl restart catalog-api.service
systemctl restart catalog-bff.service
systemctl reload-or-restart nginx.service
