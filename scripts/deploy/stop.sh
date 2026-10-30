#!/bin/bash
# Stop app services if they exist. Must never fail on a first-ever deployment.
systemctl stop catalog-bff.service 2>/dev/null || true
systemctl stop catalog-api.service 2>/dev/null || true
exit 0
