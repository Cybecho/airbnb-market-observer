import assert from "node:assert/strict";

const number = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const round = (value) => Number(value.toFixed(2));
export const calendarDays = (year, month) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();
export function derivePresence(observatory, codes) {
  const months = observatory?.presence?.months;
  assert(
    Array.isArray(months) && months.length >= 12,
    "Insufficient presence history",
  );
  assert.deepEqual(
    [...new Set(months)].sort(),
    months,
    "Presence months must be sorted and unique",
  );
  for (let i = 0; i < months.length; i++) {
    assert(
      /^20\d{2}-(0[1-9]|1[0-2])$/.test(months[i]),
      "Invalid presence month",
    );
    if (i) {
      const a = months[i - 1].split("-").map(Number),
        b = months[i].split("-").map(Number);
      assert.equal(
        (b[0] - a[0]) * 12 + b[1] - a[1],
        1,
        "Presence history has a missing calendar month",
      );
    }
  }
  const latestMonth = months.at(-1);
  const [currentYear, endMonth] = latestMonth.split("-").map(Number),
    previousYear = currentYear - 1;
  const byKey = new Map();
  for (const row of observatory.presence.rows) {
    const key = row.month + ":" + row.adminCode;
    assert(!byKey.has(key), "Duplicate presence dong/month");
    byKey.set(key, row);
  }
  const current = [...codes].map(String).sort();
  assert.equal(new Set(current).size, current.length, "Duplicate mapped code");
  const latestCodes = observatory.presence.rows
    .filter((r) => r.month === latestMonth)
    .map((r) => r.adminCode)
    .sort();
  assert.deepEqual(
    latestCodes,
    current,
    "Latest presence codes differ from reviewed map; boundary review required",
  );
  function yearFor(code, year) {
    let sum = 0,
      days = 0,
      expected = 0,
      complete = true;
    for (let month = 1; month <= endMonth; month++) {
      const n = calendarDays(year, month),
        row = byKey.get(`${year}-${String(month).padStart(2, "0")}:${code}`);
      expected += n;
      if (
        !row ||
        !number(row.mean04) ||
        !Number.isInteger(row.days04) ||
        row.days04 < 0 ||
        row.days04 > n
      ) {
        complete = false;
        continue;
      }
      days += row.days04;
      sum += row.mean04 * row.days04;
      if (row.days04 !== n) complete = false;
    }
    return {
      days,
      expected,
      complete: complete && days === expected,
      mean: days ? sum / days : null,
    };
  }
  const rows = current.map((adminCode) => {
    const a = yearFor(adminCode, currentYear),
      b = yearFor(adminCode, previousYear);
    const comparisonComplete = a.complete && b.complete;
    return {
      adminCode,
      meanCurrent04: a.complete ? round(a.mean) : null,
      meanPrevious04: b.complete ? round(b.mean) : null,
      changePercent04:
        comparisonComplete && b.mean > 0
          ? round((a.mean / b.mean - 1) * 100)
          : null,
      comparisonComplete,
      currentDays04: a.days,
      previousDays04: b.days,
    };
  });
  return {
    latestMonth,
    comparison: {
      currentYear,
      previousYear,
      endMonth,
      periodLabel: `${previousYear}·${currentYear}년 1~${endMonth}월`,
      currentLabel: `${currentYear}년 1~${endMonth}월 04시`,
      method:
        "각 연도 1월부터 최신 완결월까지 모든 달의 04시 유효일이 달력 일수와 같은 행정동만 비교. 소수 둘째 자리 월평균을 유효일수로 가중한 기간 평균. 윤년은 각 연도의 달력 일수를 사용하며, 동일 날짜 쌍·휴일 조정 비교가 아님. 경계 미관측·억제값은 0으로 대체하지 않음.",
    },
    rows,
  };
}

export function sourceLedger({
  checkedAt,
  presence,
  registry,
  mobility,
  sales,
}) {
  const automated = (id, title, sourcePeriod, sourceUpdatedAt, reason) => ({
    id,
    title,
    status: "automated",
    checkedAt,
    sourcePeriod,
    sourceUpdatedAt: sourceUpdatedAt ?? null,
    url: `https://data.seoul.go.kr/dataList/${id}/S/1/datasetView.do`,
    reason,
  });
  return [
    automated(
      "OA-23018",
      "단기체류 외국인 생활인구",
      presence.latestMonth,
      null,
      "공식 월별 ZIP. 최신 2개월과 목록 변경분을 재검사. 완결월만 반영.",
    ),
    ...registry.sources.map((s) =>
      automated(
        s.id,
        {
          foreigner: "외국인관광 도시민박업",
          hanok: "한옥체험업",
          tourist: "관광숙박업",
          lodging: "숙박업",
        }[s.key],
        registry.observedAt,
        s.pageUpdatedAt,
        `공식 공개 CSV. 영업등록 공간결합 ${s.mappedRows}/${s.operatingRows}; 미결합은 별도 기록. 원천은 3일 지연.`,
      ),
    ),
    ...[
      ["OA-22379", "외국인 이동 OD", "od"],
      ["OA-22378", "외국인 이동 목적", "purpose"],
      ["OA-22656", "외국인 이동 교통수단", "transport"],
    ].map(([id, title, key]) =>
      automated(
        id,
        title,
        mobility?.[key]?.period ?? null,
        null,
        "공식 완결월 파일. 각 자료의 분모·기간을 별도로 유지. 투숙객 수가 아님.",
      ),
    ),
    automated(
      "OA-22175",
      "행정동 여관 카드추정매출",
      sales?.period ?? null,
      null,
      "공식 최신 공개분기. 행정동 코드 정확 일치. 추정 카드매출이며 Airbnb 정산액·객실 매출·순이익이 아님.",
    ),
    {
      id: "sto-survey",
      title: "서울 숙박 설문",
      status: "review_required",
      sourcePeriod: "2025",
      url: "https://sto.or.kr/survey/16119",
      reason:
        "연례 보고서·분모·가중치·공개권을 검토한 후 수동 교체. 자동 수집 또는 최신 연도 자료로 표시하지 않음.",
    },
    {
      id: "geography",
      title: "행정동 경계·법정동 코드",
      status: "review_required",
      sourcePeriod: "2026-10-01",
      url: "https://github.com/vuski/admdongkor/tree/master/ver20261001",
      reason:
        "경계 버전 고정. 새로운 행정동 코드가 발견되면 배치 중단 및 검토 알림. 이름으로 임의 배분하지 않음.",
    },
    {
      id: "kto",
      title: "관광 데이터랩 소비 구성비",
      status: "excluded",
      sourcePeriod: "기존 조사기간",
      url: "https://datalab.visitkorea.or.kr/datalab/portal/bda/getInquiryBySexAndAge.do",
      reason:
        "재배포 권리 미확인 값은 계속 잠금. 로그인·유료·민간 자료를 자동 추출하지 않음.",
    },
    {
      id: "rent",
      title: "월세·전세",
      status: "excluded",
      url: "https://data.seoul.go.kr/dataList/OA-21276/S/1/datasetView.do",
      reason:
        "이번 핵심 판단·자동 갱신 범위에서 제외. 기존 조사 탭은 명시된 과거 스냅샷.",
    },
  ];
}
