import type { DocumentType } from './types';

/**
 * Máscaras de CPF e CNPJ: só aceitam a quantidade e o tipo certos de caracteres (CPF: 11 dígitos; CNPJ: 12 posições
 * [0-9A-Z] + 2 dígitos verificadores, que inclui o CNPJ alfanumérico). O que passar disso é descartado ao digitar.
 */
const FORMATS: Record<DocumentType, { pattern: string; accepts: (char: string, position: number) => boolean }> = {
  CPF: { pattern: '###.###.###-##', accepts: (c) => /[0-9]/.test(c) },
  CNPJ: { pattern: '##.###.###/####-##', accepts: (c, position) => (position < 12 ? /[0-9A-Z]/ : /[0-9]/).test(c) },
};

/** Tamanho máximo do campo já formatado (CPF 14, CNPJ 18). */
export function maxDocumentLength(type: DocumentType): number {
  return FORMATS[type].pattern.length;
}

/** Aplica a máscara do tipo, descartando caracteres inválidos e o que exceder o tamanho do documento. */
export function maskDocument(value: string, type: DocumentType): string {
  const { pattern, accepts } = FORMATS[type];
  const slots = pattern.split('').filter((p) => p === '#').length;
  const chars: string[] = [];
  for (const char of value.toUpperCase()) {
    if (chars.length < slots && accepts(char, chars.length)) {
      chars.push(char);
    }
  }
  let masked = '';
  let next = 0;
  for (const p of pattern) {
    if (next >= chars.length) {
      break;
    }
    masked += p === '#' ? chars[next++] : p;
  }
  return masked;
}

/** Formata uma lista de CNPJs (separados por linha, espaço, vírgula ou ponto e vírgula), um por linha. */
export function maskCompanies(text: string): string {
  return text
    .split(/[\s,;]+/)
    .map((cnpj) => maskDocument(cnpj, 'CNPJ'))
    .filter(Boolean)
    .join('\n');
}
