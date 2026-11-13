import type { Registro, AssinaturaEspelho } from '@/types';
import { calcularBancoHorasMes, formatHoras } from '@/lib/banco-horas';
import EIF_LOGO from '@/lib/eif-logo';

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function maskCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

function fmtTime(r: Registro | undefined): string {
  if (!r) return '—';
  return new Date(r.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export interface PDFParams {
  nome: string;
  cpf: string;
  matricula: string;
  cargo: string;
  unidadeNome: string;
  registros: Registro[];
  assinatura: AssinaturaEspelho | null;
  ano: number;
  mes: number;
}

export async function generatePontoPDF(p: PDFParams): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const { nome, cpf, matricula, cargo, unidadeNome, registros, assinatura, ano, mes } = p;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  type RGB = [number, number, number];
  const RED: RGB         = [191, 38, 38];
  const RED_DARK: RGB    = [115, 6, 26];
  const CREAM: RGB       = [244, 242, 226];
  const CREAM_MID: RGB   = [220, 215, 190];
  const DARK: RGB        = [30, 24, 24];
  const GRAY: RGB        = [110, 90, 90];
  const WHITE: RGB       = [255, 255, 255];
  const GREEN: RGB       = [22, 163, 74];

  const pageW  = 210;
  const mg     = 15;
  const cw     = pageW - 2 * mg;

  // ── HEADER BAND ───────────────────────────────────────────────────────────
  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW, 30, 'F');

  try {
    doc.addImage(EIF_LOGO, 'PNG', mg, 5, 20, 20);
  } catch { /* skip if image fails */ }

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('ESPELHO DE PONTO', mg + 24, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('E.I.F Alimentos  ·  Sistema de Ponto Eletrônico', mg + 24, 21);

  const mesAnoStr = `${MESES[mes - 1]} ${ano}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(mesAnoStr, pageW - mg - doc.getTextWidth(mesAnoStr), 16);

  // ── EMPLOYEE INFO ─────────────────────────────────────────────────────────
  let y = 38;

  const sectionHeader = (title: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(title, mg, y);
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.4);
    doc.line(mg, y + 2, mg + cw, y + 2);
    y += 7;
  };

  sectionHeader('DADOS DO FUNCIONÁRIO');

  const colW = cw / 2;
  const infoItems: [string, string][] = [
    ['Nome', nome],
    ['Matrícula', matricula],
    ['CPF', maskCPF(cpf)],
    ['Cargo', cargo || '—'],
    ['Unidade', unidadeNome || '—'],
    ['Período', `${MESES[mes - 1]} de ${ano}`],
  ];

  doc.setFontSize(8);
  for (let i = 0; i < infoItems.length; i++) {
    const [label, value] = infoItems[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x   = mg + col * colW;
    const ry  = y + row * 6;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text(label + ':', x, ry);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    doc.text(value, x + doc.getTextWidth(label + ':  '), ry);
  }

  y += Math.ceil(infoItems.length / 2) * 6 + 6;

  // ── BANCO DE HORAS SUMMARY ────────────────────────────────────────────────
  const banco = calcularBancoHorasMes(registros, ano, mes);

  const byDay: Record<string, Registro[]> = {};
  for (const r of registros) {
    const day = r.dataHora.slice(0, 10);
    (byDay[day] ??= []).push(r);
  }
  const days = Object.keys(byDay).sort();

  sectionHeader('RESUMO DO MÊS');

  const summaryItems: { label: string; value: string; color: RGB }[] = [
    { label: 'DIAS TRABALHADOS', value: String(days.length),                    color: DARK  },
    { label: 'HORAS TRABALHADAS', value: formatHoras(banco.totalTrabalhado),    color: DARK  },
    { label: 'HORAS ESPERADAS',  value: formatHoras(banco.totalEsperado),       color: DARK  },
    { label: 'SALDO BANCO',      value: formatHoras(banco.saldo),               color: banco.saldo >= 0 ? GREEN : RED },
  ];

  const cellW = cw / 4;
  const cellH = 15;

  for (let i = 0; i < summaryItems.length; i++) {
    const { label, value, color } = summaryItems[i];
    const x = mg + i * cellW;

    doc.setFillColor(...CREAM);
    doc.rect(x, y, cellW, cellH, 'F');
    doc.setDrawColor(...CREAM_MID);
    doc.setLineWidth(0.2);
    doc.rect(x, y, cellW, cellH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text(label, x + cellW / 2, y + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...color);
    doc.text(value, x + cellW / 2, y + 12, { align: 'center' });
  }

  y += cellH + 8;

  // ── RECORDS TABLE ─────────────────────────────────────────────────────────
  sectionHeader('REGISTROS DETALHADOS');

  const bancoByDay: Record<string, number> = {};
  for (const d of banco.detalhesPorDia) bancoByDay[d.data] = d.horasTrabalhadas;

  if (days.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text('Nenhum registro neste período.', mg, y + 4);
    y += 12;
  } else {
    const tableBody = days.map(day => {
      const recs      = byDay[day];
      const entry     = recs.find(r => r.tipo === 'Entrada');
      const lunchOut  = recs.find(r => r.tipo === 'Saída Almoço');
      const lunchIn   = recs.find(r => r.tipo === 'Entrada Almoço');
      const exitPunch = recs.find(r => r.tipo === 'Saída');
      const dateObj   = new Date(day + 'T12:00:00');
      const dateStr   = dateObj.toLocaleDateString('pt-BR', {
        weekday: 'short', day: '2-digit', month: '2-digit',
      });
      const horas = bancoByDay[day] ?? 0;

      return [
        dateStr,
        fmtTime(entry),
        fmtTime(lunchOut),
        fmtTime(lunchIn),
        fmtTime(exitPunch),
        horas > 0 ? formatHoras(horas) : '—',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Data', 'Entrada', 'Saída Alm.', 'Entrada Alm.', 'Saída', 'Total']],
      body: tableBody,
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        lineColor: CREAM_MID,
        lineWidth: 0.2,
        font: 'helvetica',
        textColor: DARK,
      },
      headStyles: {
        fillColor: RED,
        textColor: WHITE,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [249, 248, 244] as RGB,
      },
      bodyStyles: { halign: 'center' },
      columnStyles: {
        0: { halign: 'left', cellWidth: 38 },
        1: { halign: 'center', cellWidth: 28 },
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'center', cellWidth: 30 },
        4: { halign: 'center', cellWidth: 28 },
        5: { halign: 'center', cellWidth: 26 },
      },
      margin: { left: mg, right: mg },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── ASSINATURA ────────────────────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = 20; }

  sectionHeader('ASSINATURA DIGITAL');

  const sigRow = (labelText: string, confirmed: boolean, dateIso: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(labelText + ':', mg, y);

    if (confirmed) {
      doc.setTextColor(...GREEN);
      doc.setFont('helvetica', 'normal');
      doc.text(`Confirmado em ${new Date(dateIso).toLocaleDateString('pt-BR')}`, mg + 32, y);
    } else {
      doc.setTextColor(...GRAY);
      doc.setFont('helvetica', 'normal');
      doc.text('Pendente', mg + 32, y);
    }
    y += 6;
  };

  sigRow('Funcionário', assinatura?.statusFuncionario === 'Confirmado', assinatura?.assinadoFuncionarioEm ?? '');
  sigRow('Gestor (RH)', assinatura?.statusAdmin === 'Assinado', assinatura?.assinadoAdminEm ?? '');

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  const now = new Date().toLocaleDateString('pt-BR');

  for (let pg = 1; pg <= pageCount; pg++) {
    doc.setPage(pg);
    const fy = 287;
    doc.setDrawColor(...RED_DARK);
    doc.setLineWidth(0.3);
    doc.line(mg, fy - 3, pageW - mg, fy - 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(
      `Documento gerado em ${now}  ·  EIF Ponto Eletrônico  ·  Página ${pg} de ${pageCount}`,
      pageW / 2, fy, { align: 'center' },
    );
  }

  // ── SAVE ──────────────────────────────────────────────────────────────────
  const mesPad     = String(mes).padStart(2, '0');
  const nomeSimple = nome.split(' ').slice(0, 2).join('-');
  doc.save(`espelho-${ano}-${mesPad}-${nomeSimple}.pdf`);
}
