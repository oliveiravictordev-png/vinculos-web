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
  [/^limit must be between (\d+) and (\d+)$/, (m) => `O limite deve estar entre ${m[1]} e ${m[2]}.`],
  [/^product must have at most (\d+) characters$/, (m) => `O produto deve ter no máximo ${m[1]} caracteres.`],
  [/^updatedFrom must not be after updatedTo$/, () => 'A data inicial não pode ser depois da data final.'],
  [/^invalid cursor$/, () => 'A paginação expirou. Refaça a consulta.'],
  [/^format must be csv or xlsx$/, () => 'Formato de exportação inválido.'],
  [/^Username and password are required$/, () => 'Informe usuário e senha.'],
  [/^Invalid username or password$/, () => 'Usuário ou senha inválidos.'],
  [/^Authentication required$/, () => 'Sua sessão expirou. Entre novamente.'],
  [/^Access denied$/, () => 'Seu usuário não tem permissão para esta ação.'],
  [/^Database is currently unavailable, please try again$/, () => 'Banco de dados indisponível no momento. Tente novamente.'],
  [/^Too many failed login attempts, retry in (\d+) s$/, (m) => `Muitas tentativas de login com senha errada. Tente novamente em ${waitText(Number(m[1]))}.`],
  [/^username must have at most (\d+) characters$/, (m) => `O usuário deve ter no máximo ${m[1]} caracteres.`],
  [/^password must have at most (\d+) bytes$/, (m) => `A senha deve ter no máximo ${m[1]} caracteres.`],
  [/^Request rate limit exceeded, retry in (\d+) s$/, (m) => `Muitas consultas em pouco tempo. Tente novamente em ${m[1]} s.`],
  [/^Invalid request$/, () => 'Requisição inválida: confira os campos preenchidos.'],
  [/^Unexpected error, please try again$/, () => 'Erro inesperado. Tente novamente em instantes.'],
];

// Bloqueios de login passam de 1 minuto: "8 min" lê melhor que "480 s".
function waitText(seconds: number): string {
  return seconds < 90 ? `${seconds} s` : `${Math.ceil(seconds / 60)} min`;
}

export function translateApiMessage(message: string): string {
  for (const [pattern, translate] of TRANSLATIONS) {
    const match = message.match(pattern);
    if (match) {
      return translate(match);
    }
  }
  return message;
}
