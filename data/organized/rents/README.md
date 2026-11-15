# rents

Six separate aggregate tables. Primary grain is DISTRICT, never a legal/admin-dong inferred join. Monetary fields with 만원 are 10,000 KRW. Area is reported rental area, not verified exclusive area. Read definitions.json before comparing. N is public rows; N<30 caution. No costs or profit inferred.

Repository JSON is the reproducible build input. Run `node scripts/build-data.mjs` then `node scripts/validate-data.mjs`. Missing numeric facts are null, never zero. See [data contract](../../../docs/data/CONTRACT.md), per-field dictionary and source catalog.
