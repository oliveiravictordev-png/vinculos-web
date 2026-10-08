/**
 * Traduz para português as mensagens de erro da API (que responde em inglês).
 * Mensagens desconhecidas passam como vieram, para nunca esconder um erro.
 */
const TRANSLATIONS: [RegExp, (match: RegExpMatchArray) => string][] = [
  [/^document is required$/, () => 'Informe o documento.'],
  [/^document must have at most (\d+) characters$/, (m) => `O documento deve ter no máximo ${m[1]} caracteres.`],
  [/^documentType is required$/, () => 'Informe o tipo de documento.'],
  [/^documentType must be CPF or CNPJ$/, () => 'O tipo de documento deve ser CPF ou CNPJ.'],
  [/^year is required$/, () => 'Informe o ano.'],
  [/^year must be between (\d+) and (\d+)$/, (m) => `O ano deve estar entre ${m[1]} e ${m[2]}.`],
  [/^invalid document for type (\w+)$/, (m) => `Documento inválido para o tipo ${m[1]}: confira os dígitos verificadores.`],
  [/^companies must contain at least 1 CNPJ$/, () => 'Informe ao menos 1 CNPJ de empresa.'],
  [/^companies accepts at most (\d+) CNPJs$/, (m) => `Informe no máximo ${m[1]} CNPJs por consulta.`],
  [/^invalid company CNPJ: (.*)$/, (m) => `CNPJ de empresa inválido: ${m[1]}.`],
  [/^Database is currently unavailable, please try again$/, () => 'Banco de dados indisponível no momento. Tente novamente.'],
  [/^Request rate limit exceeded, retry in (\d+) s$/, (m) => `Muitas consultas em pouco tempo. Tente novamente em ${m[1]} s.`],
  [/^Invalid request$/, () => 'Requisição inválida: confira os campos preenchidos.'],
  [/^Unexpected error, please try again$/, () => 'Erro inesperado. Tente novamente em instantes.'],
];

export function translateApiMessage(message: string): string {
  for (const [pattern, translate] of TRANSLATIONS) {
    const match = message.match(pattern);
    if (match) {
      return translate(match);
    }
  }
  return message;
}
