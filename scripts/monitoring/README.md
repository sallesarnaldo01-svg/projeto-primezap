# Monitoring Notes

- Prometheus config in `prometheus.yml` scrapes:
  - API at `/metrics` on port 4000 (adjust target to container DNS if running in Docker: e.g., `api:4000`).
  - Frontend optional `/metrics` on port 8080 if exposed.
  - Node/Redis/Postgres exporters if present.

Tips
- In Linux Docker, prefer service DNS over `host.docker.internal`.
- If API exposes metrics on another path/port, update `metrics_path` and target accordingly.
- Grafana dashboards should include panels for API request rate, WhatsApp queue lengths, and DB/Redis health.

