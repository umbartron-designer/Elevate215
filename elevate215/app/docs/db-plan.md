# Database plan

There's no database today. Each upload is saved as CSV by `src/lib/server/store/csv.js`:

```
storage/versions.csv                  id,uploaded_at,uploaded_by,filename
storage/versions/<id>/financials.csv  department,month,budget,actual,forecast

storage/commitments/versions.csv                    id,uploaded_at,uploaded_by,filename
storage/commitments/versions/<id>/commitments.csv   grant_name,funder,department,restricted,month,committed
```

Grant commitments (Part 2) are kept in their own folder with their own version numbers, so they never mix with the forecast versions.

The CSV columns match the target tables one to one, so moving to a database doesn't change the upload page or the workbook reader.

## Target schema

```sql
CREATE TABLE versions (
  id          INTEGER PRIMARY KEY,
  uploaded_at TEXT NOT NULL,          -- ISO timestamp
  uploaded_by TEXT NOT NULL,
  filename    TEXT NOT NULL
);
CREATE TABLE financials (
  version_id  INTEGER NOT NULL REFERENCES versions(id),
  department  TEXT NOT NULL,
  month       TEXT NOT NULL,          -- YYYY-MM
  budget      NUMERIC(14, 2),         -- NULL = blank in the workbook
  actual      NUMERIC(14, 2),
  forecast    NUMERIC(14, 2),
  PRIMARY KEY (version_id, department, month)
);
CREATE TABLE commitment_versions (
  id          INTEGER PRIMARY KEY,
  uploaded_at TEXT NOT NULL,          -- ISO timestamp
  uploaded_by TEXT NOT NULL,
  filename    TEXT NOT NULL
);
CREATE TABLE commitments (
  version_id  INTEGER NOT NULL REFERENCES commitment_versions(id),
  grant_name  TEXT NOT NULL,          -- not "grant": GRANT is reserved in Postgres
  funder      TEXT NOT NULL,
  department  TEXT NOT NULL,
  restricted  BOOLEAN NOT NULL,       -- saved as true/false in the CSV
  month       TEXT NOT NULL,          -- YYYY-MM
  committed   NUMERIC(14, 2),         -- NULL = blank in the file
  PRIMARY KEY (version_id, grant_name, month)
);
```

Versions are never updated or deleted. Each upload adds one `versions` row and its `financials` rows in one transaction.

## Suggested database

Start with SQLite, which is a single file with nothing to host. Move to Postgres when more than one server needs the data. Use Drizzle as the query layer so the same code works with both.

## Cutover steps

1. Add `src/lib/server/store/db.js` exporting `createDbStore(url)` with the same `saveVersion(rows, { uploadedBy, filename })` contract as `csv.js`. It inserts the version and its rows in one transaction.
2. Register it in `src/lib/server/store/index.js` under `STORE=db`.
3. Run `npm run migrate` to write `storage/migration.sql` from every CSV version, then load it:
   `sqlite3 elevate215.db < storage/migration.sql` or `psql "$DATABASE_URL" -f storage/migration.sql`.
   It is safe to re-run, because versions already in the database are skipped.
4. Check that row counts match: `SELECT version_id, COUNT(*) FROM financials GROUP BY version_id` should equal the line counts of each `financials.csv`, minus the header line. Do the same for commitments: `SELECT version_id, COUNT(*) FROM commitments GROUP BY version_id` against each `storage/commitments/versions/<id>/commitments.csv`.
5. Set `STORE=db` and restart. Keep `storage/` as a backup until the next few uploads have landed in the database.
