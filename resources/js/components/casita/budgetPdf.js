// Budget as a one-page A4 PDF (the "Borrador" button of the event form).
// Built from what is on screen, saved or not. Long budgets shrink the table font so
// everything still fits on a single page.

import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';

// Adds doc.autoTable() (same behavior with the ESM and CommonJS builds of the plugin)
applyPlugin(jsPDF);
import { longDate } from './casitaUtils';

// jsPDF's built-in fonts have no "₲" glyph: use "Gs." (usual in Paraguay)
const money = (n) => `Gs. ${Math.round(Number(n) || 0).toLocaleString('es-PY')}`;

const ROSE = [225, 29, 72];
const BRAND = [64, 84, 66]; // green of the Casita logo
const DARK = [24, 24, 27];
const MUTED = [113, 113, 122];
const LINE = [228, 228, 231];

/**
 * data: { client_name, event_date, schedule, venue, menu, planner_name, notes,
 *         lines: [{ description, unit_price, quantity }], paid_total? }
 * Returns the jsPDF document (call .output('bloburl') to preview or .save(name) to download).
 */
export function buildBudgetPdf(data, { draft = true, logo = null } = {}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 15;
    const venue = data.venue || 'La Casita';
    const issued = `Emitido el ${new Date().toLocaleDateString('es-PY')}`;

    // ── Header ──
    doc.setFillColor(...(logo ? BRAND : ROSE));
    doc.rect(0, 0, W, 4, 'F');
    let y;
    if (logo) {
        // Logo on the right, title and dates on the left
        const logoW = 62;
        const logoH = Math.min(26, logoW * (logo.height / logo.width));
        doc.addImage(logo.dataUrl, logo.format, W - M - logoW, 9, logoW, logoH);
        doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...DARK);
        doc.text('Presupuesto', M, 18);
        doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUTED);
        doc.text(`${venue} · ${issued}`, M, 24);
        if (draft) doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...ROSE).text('BORRADOR', M, 30);
        const lineY = Math.max(34, 9 + logoH + 3);
        doc.setDrawColor(...DARK).setLineWidth(0.5).line(M, lineY, W - M, lineY);
        y = lineY + 8;
    } else {
        doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...DARK);
        doc.text('Presupuesto', M, 20);
        doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED);
        doc.text(venue, M, 26);
        doc.setFontSize(9).text(issued, W - M, 20, { align: 'right' });
        if (draft) doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...ROSE).text('BORRADOR', W - M, 26, { align: 'right' });
        doc.setDrawColor(...DARK).setLineWidth(0.5).line(M, 30, W - M, 30);
        y = 38;
    }

    // ── Event data (two columns) ──
    const facts = [
        ['Cliente', data.client_name || '—'],
        ['Fecha del evento', longDate(data.event_date) || 'A confirmar'],
        ['Horario', data.schedule || '—'],
        ['Lugar', venue],
        ['Menú', data.menu || '—'],
        ['Wedding planner', data.planner_name],
    ].filter(([, v]) => v);
    const colW = (W - 2 * M) / 2;
    facts.forEach(([label, value], i) => {
        const x = M + (i % 2) * colW;
        const rowY = y + Math.floor(i / 2) * 10;
        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
        doc.text(label.toUpperCase(), x, rowY);
        doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...DARK);
        doc.text(doc.splitTextToSize(String(value), colW - 6)[0], x, rowY + 4.5);
    });
    y += Math.ceil(facts.length / 2) * 10 + 2;

    // ── Lines: shrink to fit the page ──
    const lines = (data.lines || []).filter(l => String(l.description || '').trim());
    const total = lines.reduce((s, l) => s + (Number(l.unit_price) || 0) * (Number(l.quantity) || 0), 0);
    const footerSpace = 46; // totals + notes + footer note
    const available = H - y - footerSpace;
    const rowH = Math.min(8, available / (lines.length + 1));
    const fontSize = Math.max(5.5, Math.min(10, rowH * 1.35));
    const padding = Math.max(0.4, (rowH - fontSize * 0.3528 * 1.15) / 2);

    doc.autoTable({
        startY: y,
        margin: { left: M, right: M },
        head: [['Detalle', 'Precio', 'Cantidad', 'Total']],
        body: lines.map(l => [
            String(l.description).trim(),
            money(l.unit_price),
            (Number(l.quantity) || 0).toLocaleString('es-PY'),
            money((Number(l.unit_price) || 0) * (Number(l.quantity) || 0)),
        ]),
        theme: 'plain',
        styles: { font: 'helvetica', fontSize, cellPadding: { top: padding, bottom: padding, left: 2, right: 2 }, textColor: DARK, lineColor: LINE, overflow: 'ellipsize' },
        headStyles: { fillColor: [244, 244, 245], textColor: [82, 82, 91], fontStyle: 'bold', fontSize: Math.min(fontSize, 8) },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { halign: 'right', cellWidth: 34 },
            2: { halign: 'right', cellWidth: 20 },
            3: { halign: 'right', cellWidth: 36, fontStyle: 'bold' },
        },
        didParseCell: (hook) => {
            if (hook.section === 'head' && hook.column.index > 0) hook.cell.styles.halign = 'right';
        },
        didDrawCell: (hook) => {
            if (hook.section === 'body') {
                doc.setDrawColor(...LINE).setLineWidth(0.2);
                doc.line(hook.cell.x, hook.cell.y + hook.cell.height, hook.cell.x + hook.cell.width, hook.cell.y + hook.cell.height);
            }
        },
        pageBreak: 'avoid',
    });

    // ── Totals ──
    y = doc.lastAutoTable.finalY + 6;
    const boxX = W - M - 85;
    const paid = Number(data.paid_total) || 0;
    const totalsRows = [['Total de presupuesto', money(total), true]];
    if (paid) {
        totalsRows.push(['Total abonado', money(paid), false]);
        totalsRows.push(['Saldo pendiente', money(total - paid), true]);
    }
    totalsRows.forEach(([label, value, strong]) => {
        doc.setFont('helvetica', strong ? 'bold' : 'normal').setFontSize(strong ? 11 : 9.5).setTextColor(...DARK);
        doc.text(label, boxX, y);
        doc.text(value, W - M, y, { align: 'right' });
        doc.setDrawColor(...(strong ? DARK : LINE)).setLineWidth(strong ? 0.4 : 0.2).line(boxX, y + 2, W - M, y + 2);
        y += 8;
    });

    // ── Notes ──
    if (data.notes) {
        y += 2;
        doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...DARK).text('Observaciones:', M, y);
        doc.setFont('helvetica', 'normal').text(doc.splitTextToSize(String(data.notes), W - 2 * M - 26).slice(0, 2), M + 24, y);
    }

    // ── Footer ──
    if (draft) {
        doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED).text('Borrador de presupuesto: precios y cantidades sujetos a confirmación.', W / 2, H - 8, { align: 'center' });
    }

    return doc;
}

export const budgetFileName = (data, draft = true) => {
    const name = String(data.client_name || 'cliente').replace(/[\\/:*?"<>|]+/g, '').trim();
    return `Presupuesto ${name}${draft ? ' (borrador)' : ''}.pdf`;
};
