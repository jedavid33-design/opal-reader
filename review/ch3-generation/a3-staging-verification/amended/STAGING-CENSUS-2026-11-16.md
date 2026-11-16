# STAGING CENSUS — 2026-11-16 (reads only, taken for the verification package)

Worker `opalreader-api-v2` (staging):
- /health: {"ok":true,"app":"OpalReader API v2","version":"2.0.0","build":"2fe71b5f3194f0c022a5959f1206c57e7a3240f2","coordinator":"armed","scope":"staging-smoke","generation":"halted"}
- Script ETag: 61553a072a162db80c606f9f3c03aea1c1344d57b0fefe11675acd470d200e81 (888,430 bytes)
- Settings: compatibility_date 2026-08-29, flags [nodejs_compat], observability enabled
- Bindings (8): ALLOWED_ORIGIN plain_text https://jedavid33-design.github.io;
  COORDINATOR durable_object_namespace class_name OpalReaderCoordinator namespace_id 40873aba35a24de0a79f7bad03b9077d;
  GENERATION_HALT plain_text "1"; OPALREADER_ACCESS_TOKEN secret_text;
  OPALREADER_GENERATION queue queue_name opalreader-generation;
  OPALREADER_STORAGE r2_bucket bucket_name opalreader-storage;
  OPALREADER_V2_SCOPE plain_text staging-smoke; R2_KEY_PREFIX plain_text smoke-p8/
- NO GEMINI_API_KEY binding. NO migration-operator token binding.
- Schedules: [] (no Cron Triggers)

Production contrasts (same-day reads): COORDINATOR namespace 005ba6f8634a43b99543036d7ad99510,
class OpalReaderCoordinatorProd; GENERATION_HALT "0"; schedules [].
