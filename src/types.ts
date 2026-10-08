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

export interface TokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
}

/** Corpo de erro RFC 9457 devolvido pelo ApiExceptionHandler. */
export interface ProblemDetail {
  title?: string;
  detail?: string;
  status?: number;
}
