# Step D3 — observability: PASS, no PATCH
GET script-settings after upload (script-settings-after.json):
observability enabled + logs enabled + persist true — survived the
upload, identical to pre-deploy. The conditional C1 observability-only
PATCH was NOT performed. No settings edits of any kind. D2's PUT was
the only mutation of this deploy.
