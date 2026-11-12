// The printed Snapshot (Josh, 2026-11-12), in the program's own colours like
// the report: the brand band and gold rule, the period, the blocks Josh left
// ticked as tiles and small tables, then — when ticked — the attendance
// report: a summary of every session, each session's roll, each student's
// total. A source line on the last page says where the numbers came from.
import jsPDF from "jspdf";
import type { ProgramConfig } from "@/lib/programs";
import { longDay, shortDay, type Snapshot, type SnapshotBlockKey, SNAPSHOT_BLOCKS } from "@/lib/programSnapshot";

export interface SnapshotPdfOptions {
  program: ProgramConfig;
  period: string;
  blocks: Set<SnapshotBlockKey>;
  snapshot: Snapshot;
  /** YYYY-MM-DD, America/New_York. */
  printedOn: string;
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const DARK: RGB = [17, 24, 39];
const GRAY: RGB = [107, 114, 128];
const RULE: RGB = [209, 213, 219];
const SHADE: RGB = [243, 244, 246];

export function buildProgramSnapshotPdf(opts: SnapshotPdfOptions): jsPDF {
  const { program, snapshot: s, blocks } = opts;
  const B = program.brand;
  const green = hex(B.primary), gold = hex(B.accent);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56, TEXT_W = W - M * 2, BOTTOM = H - 48;
  const on = (k: SnapshotBlockKey) => blocks.has(k);

  // ── Letterhead ──
  const bandH = 86;
  const letterhead = () => {
    doc.setFillColor(...green); doc.rect(0, 0, W, bandH, "F");
    doc.setFillColor(...gold); doc.rect(0, bandH, W, 5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.setTextColor(...gold);
    doc.text(B.wordmark, M, 44);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
    doc.text(B.sub, M + 1, 58);
    doc.setFont("helvetica", "bolditalic"); doc.setFontSize(10.5);
    doc.text(B.tagline, M, 74);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
    doc.text("Snapshot", W - M, 40, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...gold);
    doc.text(opts.period, W - M, 56, { align: "right" });
  };
  letterhead();
  let y = bandH + 34;
  const need = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); letterhead(); y = bandH + 34; } };
  const setType = (size: number, color: RGB, style: "normal" | "bold" | "italic" = "normal") => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color); };
  const sectionTitle = (text: string) => {
    need(40);
    y += 6;
    setType(9, green, "bold");
    doc.text(text.toUpperCase(), M, y + 9);
    doc.setDrawColor(...gold); doc.setLineWidth(1); doc.line(M, y + 15, M + 28, y + 15);
    y += 26;
  };

  // ── Tiles: the headline figures that are on ──
  const tiles: Array<[string, string, string?]> = [];
  if (on("reached")) tiles.push(["Students reached", String(s.reached.students), s.reached.registered != null ? `of ${s.reached.registered} registered · ${s.reached.pct}%` : undefined]);
  if (on("sessions")) {
    tiles.push(["Sessions held", String(s.sessions.held), s.sessions.planned ? `of ${s.sessions.planned} planned` : undefined]);
    tiles.push(["Check-ins", String(s.sessions.checkIns), "in the period"]);
    tiles.push(["Average per session", String(s.sessions.avg), `${s.sessions.checkIns} check-ins over ${s.sessions.held} session${s.sessions.held === 1 ? "" : "s"}`]);
  }
  if (on("minority")) tiles.push(["Minority", `${s.minority.pct}%`, `${s.minority.n} of ${s.minority.recorded} with a race recorded`]);
  if (on("disadvantaged")) tiles.push(["Economically disadvantaged", `${s.disadvantaged.pct}%`, `${s.disadvantaged.n} of ${s.disadvantaged.of} students`]);
  if (tiles.length) {
    const cols = 3, gap = 10;
    const tw = (TEXT_W - gap * (cols - 1)) / cols, th = 62;
    const rowsN = Math.ceil(tiles.length / cols);
    need(rowsN * (th + gap));
    tiles.forEach(([label, value, sub], i) => {
      const x = M + (i % cols) * (tw + gap), ty = y + Math.floor(i / cols) * (th + gap);
      doc.setFillColor(...green); doc.roundedRect(x, ty, tw, th, 6, 6, "F");
      setType(20, [255, 255, 255], "bold"); doc.text(value, x + 12, ty + 28);
      setType(7.5, gold, "bold"); doc.text(label.toUpperCase(), x + 12, ty + 41);
      if (sub) { setType(7.5, [255, 255, 255]); doc.text(doc.splitTextToSize(sub, tw - 24)[0] as string, x + 12, ty + 52); }
    });
    y += rowsN * (th + gap) + 8;
  }

  // ── Breakdown tables, two to a row ──
  const tables: Array<[string, Array<{ label: string; n: number; pct: number }>]> = [];
  if (on("grade") && s.grade.length) tables.push(["Grade", s.grade]);
  if (on("cte") && s.cte.length) tables.push(["CTE program", s.cte]);
  if (on("sex") && s.sex.length) tables.push(["Male / female", s.sex]);
  if (on("race") && s.race.length) tables.push(["Race / ethnicity", s.race]);
  const drawTable = (x: number, w: number, title: string, rows: Array<{ label: string; n: number; pct: number }>) => {
    let ty = y;
    setType(9, green, "bold"); doc.text(title.toUpperCase(), x, ty + 9);
    doc.setDrawColor(...gold); doc.setLineWidth(1); doc.line(x, ty + 15, x + 28, ty + 15);
    ty += 24;
    for (const r of rows) {
      const lines = doc.splitTextToSize(r.label, w - 92) as string[];
      const h = 14 * lines.length + 4;
      setType(9.5, DARK); lines.forEach((ln, i) => doc.text(ln, x, ty + 10 + i * 14));
      setType(9.5, DARK, "bold"); doc.text(String(r.n), x + w - 46, ty + 10, { align: "right" });
      setType(9, GRAY); doc.text(`${r.pct}%`, x + w, ty + 10, { align: "right" });
      // A thin bar under the row, in the brand colour.
      doc.setFillColor(...SHADE); doc.rect(x, ty + h - 1, w, 2, "F");
      doc.setFillColor(...green); doc.rect(x, ty + h - 1, (w * r.pct) / 100, 2, "F");
      ty += h + 4;
    }
    return ty - y;
  };
  for (let i = 0; i < tables.length; i += 2) {
    const pair = tables.slice(i, i + 2);
    const colW = (TEXT_W - 24) / 2;
    const est = Math.max(...pair.map(([, r]) => 24 + r.length * 20));
    need(est + 10);
    let used = 0;
    pair.forEach(([title, rows], k) => { used = Math.max(used, drawTable(M + k * (colW + 24), colW, title, rows)); });
    y += used + 12;
  }

  // ── Comparison ──
  if (on("comparison") && s.comparison) {
    sectionTitle("Compared to the previous period of the same length");
    const colW = TEXT_W / 4;
    s.comparison.forEach((c, i) => {
      const x = M + i * colW;
      setType(8, GRAY, "bold"); doc.text(c.label.toUpperCase(), x, y + 8);
      setType(14, DARK, "bold"); doc.text(String(c.now), x, y + 26);
      const sign = c.delta > 0 ? "+" : "";
      setType(9, c.delta >= 0 ? green : [191, 15, 62]); doc.text(`${sign}${c.delta} vs ${c.before}`, x, y + 40);
    });
    y += 54;
  }

  // ── Moments ──
  if (on("moments") && s.moments.length) {
    sectionTitle("Weekly Standout Moments");
    for (const m of s.moments) {
      const lines = doc.splitTextToSize(m.notes, TEXT_W) as string[];
      need(16 + lines.length * 13 + 8);
      setType(9.5, green, "bold"); doc.text(m.week, M, y + 9); y += 15;
      setType(9.5, DARK); for (const ln of lines) { need(13); doc.text(ln, M, y + 9); y += 13; }
      y += 8;
    }
  }

  // ── The attendance report ──
  if (on("attendance") && s.attendance.sessions.length) {
    doc.addPage(); letterhead(); y = bandH + 34;
    setType(15, DARK, "bold"); doc.text("Attendance report", M, y + 12); y += 20;
    setType(9.5, GRAY); doc.text(`${s.attendance.sessions.length} session${s.attendance.sessions.length === 1 ? "" : "s"} · ${s.sessions.checkIns} check-ins · ${s.reached.students} students`, M, y + 10); y += 24;

    const header = (cells: Array<[string, number, "left" | "right"]>) => {
      need(22);
      doc.setFillColor(...green); doc.rect(M, y, TEXT_W, 18, "F");
      setType(8.5, [255, 255, 255], "bold");
      cells.forEach(([t, x, a]) => doc.text(t, x, y + 12, { align: a }));
      y += 18;
    };
    const row = (cells: Array<[string, number, "left" | "right"]>, bold = false, shade = false) => {
      need(16);
      if (shade) { doc.setFillColor(...SHADE); doc.rect(M, y, TEXT_W, 16, "F"); }
      setType(9, DARK, bold ? "bold" : "normal");
      cells.forEach(([t, x, a]) => doc.text(t, x, y + 11, { align: a }));
      doc.setDrawColor(...RULE); doc.setLineWidth(0.4); doc.line(M, y + 16, M + TEXT_W, y + 16);
      y += 16;
    };
    const R = M + TEXT_W;

    // Summary: one row per session.
    sectionTitle("Every session");
    header([["Session", M + 6, "left"], ["Checked in", R - 6, "right"]]);
    s.attendance.sessions.forEach((ss, i) => row([[longDay(ss.date), M + 6, "left"], [String(ss.count), R - 6, "right"]], false, i % 2 === 1));
    row([["Total", M + 6, "left"], [String(s.sessions.checkIns), R - 6, "right"]], true, true);
    row([["Average per session", M + 6, "left"], [String(s.sessions.avg), R - 6, "right"]], true, false);
    y += 10;

    // Each session's roll.
    sectionTitle("Who checked in");
    for (const ss of s.attendance.sessions) {
      need(40);
      setType(10, DARK, "bold"); doc.text(longDay(ss.date), M, y + 10);
      setType(9, GRAY); doc.text(`${ss.count} checked in`, R, y + 10, { align: "right" });
      y += 16;
      // Three names across.
      const cols = 3, cw = TEXT_W / cols;
      ss.people.forEach((p, i) => {
        if (i % cols === 0) need(14);
        const x = M + (i % cols) * cw;
        const ry = y + 10;
        setType(9, DARK); doc.text(doc.splitTextToSize(p.name, cw - 70)[0] as string, x, ry);
        if (p.time) { setType(8, GRAY); doc.text(p.time, x + cw - 8, ry, { align: "right" }); }
        if (i % cols === cols - 1 || i === ss.people.length - 1) y += 14;
      });
      y += 8;
    }

    // Each student's total.
    y += 6;
    sectionTitle("Each student");
    header([["Student", M + 6, "left"], ["Sessions", R - 90, "right"], ["Of", R - 50, "right"], ["Rate", R - 6, "right"]]);
    s.attendance.students.forEach((st, i) => row([[st.name, M + 6, "left"], [String(st.attended), R - 90, "right"], [String(st.of), R - 50, "right"], [`${st.pct}%`, R - 6, "right"]], false, i % 2 === 1));
  }

  // ── Source line and footer ──
  need(30);
  y += 10;
  setType(8, GRAY, "italic");
  doc.text(`From NLA's ${program.name} check-in records, printed ${new Date(`${opts.printedOn}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`, M, y + 8);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...green); doc.rect(0, H - 26, W, 26, "F");
    doc.setFillColor(...gold); doc.rect(0, H - 28, W, 2, "F");
    setType(8.5, [255, 255, 255]);
    doc.text(`${program.name} at No Limits Academy · ${B.tagline}`, M, H - 10);
    doc.text(`${p} / ${pages}`, W - M, H - 10, { align: "right" });
  }
  return doc;
}

export const snapshotFileName = (program: ProgramConfig, period: string, printedOn: string) =>
  `${program.name.replace(/[^\w]+/g, "")}_Snapshot_${period.replace(/[^\w]+/g, "-")}_${printedOn}.pdf`;

/** The labels of the blocks, for the sheet's list. */
export const blockLabel = (k: SnapshotBlockKey) => SNAPSHOT_BLOCKS.find((b) => b.key === k)?.label ?? k;
export { shortDay };
