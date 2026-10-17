const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata centavos (inteiro) como moeda brasileira. */
export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

/** Formata um valor já em reais. */
export function formatBRL(reais: number): string {
  return brl.format(reais);
}

/** Converte reais (number) em centavos inteiros, sem erro de ponto flutuante. */
export function toCents(reais: number): number {
  return Math.round(reais * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Formato curto para células pequenas, a partir de centavos (ex.: "R$ 476", "R$ 1,5mil"). */
export function formatCentsShort(cents: number): string {
  const reais = cents / 100;
  if (reais < 1000) return `R$ ${Math.round(reais)}`;
  const fmt = (n: number) => n.toFixed(1).replace('.', ',').replace(/,0$/, '');
  if (reais < 1_000_000) return `R$ ${fmt(reais / 1000)}mil`;
  return `R$ ${fmt(reais / 1_000_000)}mi`;
}

const brlCompact =new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Formato curto para eixos de gráfico (ex.: "R$ 8 mil"). Recebe reais. */
export function formatBRLCompact(reais: number): string {
  return brlCompact.format(reais);
}
