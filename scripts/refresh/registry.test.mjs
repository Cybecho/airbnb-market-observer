import { decodeCp949 } from "./io.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { parseCsv, pointInGeometry, projectCoordinates } from "./registry.mjs";

test("parseCsv handles CP949-decoded quoted commas, escaped quotes, and newlines", () => {
  const csv = [
    "개방자치단체코드,관리번호,영업상태코드,영업상태명,상세영업상태코드,상세영업상태명,좌표정보(X),좌표정보(Y),사업장명",
    '1100000,A-1,01,영업/정상,13,영업중,200000,450000,"쉼, ""한옥"""',
    '1100001,A-2,03,폐업,02,폐업,200001,450001,"two\nlines"',
  ].join("\n");
  const rows = parseCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].OPNSFTEAMCODE, "1100000");
  assert.equal(rows[0].BPLCNM, '쉼, "한옥"');
  assert.equal(rows[1].BPLCNM, "two\nlines");
});

test("parseCsv rejects missing identity or coordinate schema columns", () => {
  assert.throws(
    () => parseCsv("MGTNO,X,Y\na,1,2\n"),
    /missing required CSV column OPNSFTEAMCODE/,
  );
});

test("pointInGeometry distinguishes interior, hole, and boundary", () => {
  const geometry = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      [
        [3, 3],
        [7, 3],
        [7, 7],
        [3, 7],
        [3, 3],
      ],
    ],
  };
  assert.equal(pointInGeometry([2, 2], geometry), "inside");
  assert.equal(pointInGeometry([5, 5], geometry), "outside");
  assert.equal(pointInGeometry([3, 5], geometry), "boundary");
  assert.equal(pointInGeometry([12, 5], geometry), "outside");
});

test("pointInGeometry supports MultiPolygon", () => {
  const geometry = {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
      [
        [
          [5, 5],
          [6, 5],
          [6, 6],
          [5, 6],
          [5, 5],
        ],
      ],
    ],
  };
  assert.equal(pointInGeometry([5.5, 5.5], geometry), "inside");
});

test("strict Linux CP949 accepts extended Hangul and rejects incomplete bytes", async () => {
  assert.equal(
    await decodeCp949(Buffer.from([0xb0, 0xa1, 0x81, 0x41])),
    "가갂",
  );
  await assert.rejects(decodeCp949(Buffer.from([0x81])), /CP949/);
});

test("PROJ respects source east/north X/Y instead of EPSG north/east ordering", async () => {
  const [[longitude, latitude]] = await projectCoordinates([[200000, 450000]]);
  assert.ok(longitude > 126.99 && longitude < 127.01);
  assert.ok(latitude > 37.54 && latitude < 37.56);
});
