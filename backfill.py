"""Rebuild yanolja_seoul_shared_monthly.csv from Yanolja Research DataLab.

Downloads the 9 free .xlsx files (no login) from
https://www.yanolja-research.com/common/fileDown?type=4&number=<N>
and extracts Seoul (서울) x 공유숙박 monthly rows.

Usage: python3 backfill.py
Output: seoul-shared-monthly.csv in the same directory.
"""
import csv
import urllib.parse
import urllib.request

import openpyxl

FILES = {
    4: ("2023년", "2025-10-24"),
    5: ("2024년", "2025-10-24"),
    6: ("2025년 1분기", "2025-10-24"),
    12: ("2025년 2분기", "2026-06-04"),
    15: ("2025년 3분기", "2025-12-01"),
    17: ("2025년 4분기", "2026-02-19"),
    19: ("2026년 1분기", "2026-05-13"),
    21: ("2026년 2분기", "2026-10-05"),
    24: ("2026년 3분기", "2026-10-27"),
}


def col(hdr, *names):
    for i, h in enumerate(hdr):
        if h in names:
            return i
    raise KeyError(names)


def main():
    rows = {}
    for n, (label, registered) in FILES.items():
        name = f"{label} 국내 숙박업 실적 지표.xlsx"
        url = ("https://www.yanolja-research.com/common/fileDown?type=4&number="
               + str(n) + "&name=" + urllib.parse.quote(name))
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        assert data[:2] == b"PK", f"file {n} is not xlsx"
        path = f"yanolja_{n}.xlsx"
        open(path, "wb").write(data)
        wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
        ws = wb[wb.sheetnames[0]]
        rr = list(ws.iter_rows(values_only=True))
        h = rr[0]
        d = col(h, "날짜")
        r_ = col(h, "지역_국문", "지역")
        t = col(h, "숙소유형_국문", "숙소유형")
        a = h.index("ADR")
        o = h.index("OCC")
        v = h.index("REVPAR")
        for row in rr[1:]:
            if row[r_] == "서울" and row[t] == "공유숙박":
                m = str(row[d])
                val = (int(round(row[a])), round(float(row[o]), 2),
                       int(round(row[v])), label, n, registered)
                if m in rows and rows[m] != val:
                    raise SystemExit(f"conflict {m}: {rows[m]} vs {val}")
                rows[m] = val
    months = sorted(rows)
    with open("seoul-shared-monthly.csv", "w", newline="",
              encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["month", "adr_krw", "occ_pct", "revpar_krw",
                    "source_file", "file_number", "file_registered"])
        for m in months:
            adr, occ, rev, label, n, reg = rows[m]
            w.writerow([m, adr, occ, rev, label, n, reg])
    print(f"{len(months)} months: {months[0]}-{months[-1]}")


if __name__ == "__main__":
    main()
