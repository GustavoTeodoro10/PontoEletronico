import type { Registro, BancoHorasDia, BancoHorasMes } from '@/types';

const HORAS_ESPERADAS_DIA = 8;

function isUtilDay(date: Date): boolean {
  const dow = date.getDay();
  return dow >= 1 && dow <= 5; // Mon–Fri
}

/** Returns hours worked in a list of registros for a single day, using paired punches. */
export function calcularHorasDia(registros: Registro[]): number {
  const sorted = [...registros].sort((a, b) =>
    new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()
  );

  let total = 0;
  let lastEntrada: Date | null = null;

  for (const r of sorted) {
    if (r.tipo === 'Entrada' || r.tipo === 'Entrada Almoço') {
      lastEntrada = new Date(r.dataHora);
    } else if ((r.tipo === 'Saída' || r.tipo === 'Saída Almoço') && lastEntrada) {
      const diff = (new Date(r.dataHora).getTime() - lastEntrada.getTime()) / 3_600_000;
      total += diff;
      lastEntrada = null;
    }
  }

  return Math.round(total * 100) / 100;
}

/** Returns full banco-de-horas breakdown for a month. */
export function calcularBancoHorasMes(
  registros: Registro[],
  ano: number,
  mes: number
): BancoHorasMes {
  const prefix = `${ano}-${String(mes).padStart(2, '0')}`;

  // Group registros by day
  const byDay: Record<string, Registro[]> = {};
  for (const r of registros) {
    if (!r.dataHora.startsWith(prefix)) continue;
    const day = r.dataHora.slice(0, 10);
    (byDay[day] ??= []).push(r);
  }

  // Count expected working days in the month
  const daysInMonth = new Date(ano, mes, 0).getDate();
  let totalEsperado = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(ano, mes - 1, d);
    if (isUtilDay(dt)) totalEsperado += HORAS_ESPERADAS_DIA;
  }

  // Build per-day details
  const detalhesPorDia: BancoHorasDia[] = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, recs]) => {
      const dt = new Date(data + 'T12:00:00');
      const esperado = isUtilDay(dt) ? HORAS_ESPERADAS_DIA : 0;
      const trabalhado = calcularHorasDia(recs);
      return {
        data,
        horasTrabalhadas: trabalhado,
        horasEsperadas: esperado,
        saldo: Math.round((trabalhado - esperado) * 100) / 100,
      };
    });

  const totalTrabalhado = Math.round(
    detalhesPorDia.reduce((s, d) => s + d.horasTrabalhadas, 0) * 100
  ) / 100;

  return {
    totalTrabalhado,
    totalEsperado,
    saldo: Math.round((totalTrabalhado - totalEsperado) * 100) / 100,
    detalhesPorDia,
  };
}

/** Formats hours as "8h00" or "−2h30". */
export function formatHoras(horas: number): string {
  const neg = horas < 0;
  const abs = Math.abs(horas);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${neg ? '−' : ''}${h}h${String(m).padStart(2, '0')}`;
}
