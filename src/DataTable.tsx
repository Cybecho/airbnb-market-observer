import { useEffect, useMemo, useState } from "react";
import { Search, Download, ChevronRight } from "lucide-react";
import { download, fmt, numeric, type Row } from "./data";
export type Column = { key: string; label: string; unit?: string };
export default function DataTable({
  rows,
  cols,
  onSelect,
  fileName = "market-observer.csv",
}: {
  rows: Row[];
  cols: Column[];
  onSelect?: (r: Row) => void;
  fileName?: string;
}) {
  const [sort, setSort] = useState(""),
    [asc, setAsc] = useState(false),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows, query, sort, asc]);
  const filtered = useMemo(
    () =>
      rows
        .filter((r) =>
          cols.some((c) =>
            String(r[c.key] ?? "")
              .toLowerCase()
              .includes(query.toLowerCase()),
          ),
        )
        .sort((a, b) => {
          if (!sort) return 0;
          const av = a[sort],
            bv = b[sort];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (
            (numeric(av) && numeric(bv)
              ? av - bv
              : String(av).localeCompare(String(bv), "ko")) * (asc ? 1 : -1)
          );
        }),
    [rows, cols, query, sort, asc],
  );
  return (
    <div className="data-table">
      <div className="table-tools">
        <label className="table-search">
          <Search size={15} />
          <input
            aria-label="표 검색"
            placeholder="표 안에서 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span>{filtered.length.toLocaleString()}개 결과</span>
        <button
          className="quiet"
          onClick={() =>
            download(
              filtered,
              cols.map((c) => c.key),
              fileName,
            )
          }
        >
          <Download size={14} /> CSV
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  aria-sort={
                    sort === c.key ? (asc ? "ascending" : "descending") : "none"
                  }
                >
                  <button
                    onClick={() => {
                      setAsc(sort === c.key ? !asc : false);
                      setSort(c.key);
                    }}
                  >
                    {c.label}
                    <span className="sort-mark">
                      {sort === c.key ? (asc ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(page * 30, (page + 1) * 30).map((r, i) => (
              <tr
                key={`${r.admin_code ?? r.listingId ?? r.legal_dong_code ?? "row"}-${i}`}
              >
                {cols.map((c, j) => (
                  <td key={c.key}>
                    {j === 0 && onSelect ? (
                      <button className="text-link" onClick={() => onSelect(r)}>
                        {String(r[c.key] ?? "미제공")}
                        <ChevronRight size={12} />
                      </button>
                    ) : r[c.key] == null ? (
                      <span className="null">미제공</span>
                    ) : numeric(r[c.key]) ? (
                      fmt(r[c.key], c.unit)
                    ) : /^https?:\/\//.test(String(r[c.key])) ? (
                      <a
                        className="text-link"
                        href={String(r[c.key])}
                        target="_blank"
                        rel="noreferrer"
                      >
                        원문 보기 ↗
                      </a>
                    ) : (
                      String(r[c.key])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="empty-inline">
          조건에 맞는 관측값이 없습니다. 다른 지역이나 기간을 선택해 보세요.
        </div>
      )}
      {filtered.length > 30 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>
            이전 페이지
          </button>
          <span>
            {page + 1} / {Math.ceil(filtered.length / 30)} · 30행씩
          </span>
          <button
            disabled={(page + 1) * 30 >= filtered.length}
            onClick={() => setPage(page + 1)}
          >
            다음 페이지
          </button>
        </div>
      )}
    </div>
  );
}
export function GenericDataset({
  title,
  rows,
  note,
}: {
  title: string;
  rows?: Row[];
  note: string;
}) {
  const actual = Array.isArray(rows) ? rows : [];
  const keys = actual.length
    ? Object.keys(actual[0]).filter(
        (k) => !actual.some((r) => r[k] !== null && typeof r[k] === "object"),
      )
    : [];
  return (
    <section className="card">
      <h3>{title}</h3>
      <p className="subtle">{note}</p>
      {actual.length ? (
        <DataTable
          rows={actual}
          cols={keys.map((key) => ({ key, label: key }))}
        />
      ) : (
        <p className="empty-inline">현재 연결된 관측값이 없습니다.</p>
      )}
    </section>
  );
}
