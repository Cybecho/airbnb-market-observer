# geography

Actual WGS84 [longitude,latitude] Seoul FeatureCollection from vuski/admdongkor 2026-10-01. Original SGIS KOGL1 and processing CC BY4 required. AMO filtered Seoul and normalized fields; no simplification. admin_code is first eight digits of official adm_cd2, NOT statistical adm_cd. Dashboard SVG paths are display coordinates, not WGS84.

Repository JSON is the reproducible build input. Run `node scripts/build-data.mjs` then `node scripts/validate-data.mjs`. Missing numeric facts are null, never zero. See [data contract](../../../docs/data/CONTRACT.md), per-field dictionary and source catalog.
