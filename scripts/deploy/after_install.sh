#!/bin/bash
set -euo pipefail
chown -R app:app /opt/app/api /opt/app/bff
chmod -R a+rX /opt/app/web /opt/app/config

install -m 644 /opt/app/config/catalog-api.service /etc/systemd/system/catalog-api.service
install -m 644 /opt/app/config/catalog-bff.service /etc/systemd/system/catalog-bff.service
install -m 644 /opt/app/config/nginx-app.conf /etc/nginx/conf.d/app.conf

systemctl daemon-reload
nginx -t
