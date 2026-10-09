/** Espelho dos records DTO da API (pacote web.dto). */

export type DocumentType = 'CPF' | 'CNPJ';

export interface CustomerKey {
  year: number | null;
  documentType: DocumentType;
  document: string;
}

export type CompaniesRequest = CustomerKey;

export interface CompaniesResponse {
  companies: string[];
}

export interface RecordsRequest extends CustomerKey {
  companies: string[];
}

export interface RecordItem {
  id: number;
  product: string;
  amount: number;
  updatedAt: string;
}

export interface CompanyRecords {
  company: string;
  records: RecordItem[];
}

export interface RecordsResponse {
  companies: CompanyRecords[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

/** Sessão do navegador: o token fica só no cookie HttpOnly, nunca aqui. */
export interface SessionResponse {
  username: string;
  scopes: string[];
  expiresAt: string;
}

export interface SearchRequest extends CustomerKey {
  companies: string[];
  product?: string;
  updatedFrom?: string;
  updatedTo?: string;
  limit?: number;
  cursor?: string;
}

export interface SearchItem extends RecordItem {
  company: string;
}

export interface SearchTotals {
  records: number;
  companies: number;
  amount: number;
}

export interface SearchResponse {
  items: SearchItem[];
  nextCursor: string | null;
  totals: SearchTotals;
}

export type AuditAction = 'COMPANIES' | 'RECORDS' | 'SEARCH' | 'EXPORT_CSV' | 'EXPORT_XLSX';
export type AuditOutcome = 'SUCCESS' | 'REJECTED' | 'FAILED';

export interface HistoryItem {
  action: AuditAction;
  at: string;
  year: number;
  documentType: DocumentType;
  document: string;
  outcome: AuditOutcome;
  resultCount: number;
  durationMs: number;
}

export interface HistoryResponse {
  items: HistoryItem[];
}

/** Resultado de uma exportação: o arquivo e se ele foi cortado no limite de linhas. */
export interface ExportResult {
  truncated: boolean;
}

/** Corpo de erro RFC 9457 devolvido pelo ApiExceptionHandler. */
export interface ProblemDetail {
  title?: string;
  detail?: string;
  status?: number;
}
