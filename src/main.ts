import './style.css';
import { ApiError, findCompanies, findRecords } from './api';
import { translateApiMessage } from './messages';
import type { CompanyRecords, CustomerKey, DocumentType, RecordItem } from './types';

type Endpoint = 'companies' | 'records';

const ENDPOINTS: Record<Endpoint, { title: string; description: string }> = {
  companies: {
    title: 'Empresas do cliente',
    description: 'POST /api/v1/customers/companies: devolve os CNPJs das empresas ligadas à chave do cliente.',
  },
  records: {
    title: 'Registros por empresa',
    description: 'POST /api/v1/customers/records: devolve os registros do cliente em cada empresa (até 100).',
  },
};

// Títulos dos erros por status; o detalhe vem da API, traduzido em messages.ts.
const ERROR_TITLES: Record<number, string> = {
  0: 'Erro de rede',
  400: 'Dados inválidos',
  429: 'Muitas requisições',
  503: 'Serviço indisponível',
};

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const form = query<HTMLFormElement>('#query-form');
const submitButton = query<HTMLButtonElement>('#query-form button[type="submit"]');
const companiesField = query<HTMLDivElement>('#companies-field');
const companiesInput = query<HTMLTextAreaElement>('#companies');
const fillCompaniesButton = query<HTMLButtonElement>('#fill-companies');
const result = query<HTMLElement>('#result');
const menuItems = Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-item'));

let current: Endpoint = 'companies';

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}

/** Cria um elemento com propriedades e filhos; texto vindo da API entra sempre como texto, nunca como HTML. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
}

function selectEndpoint(endpoint: Endpoint): void {
  current = endpoint;
  for (const item of menuItems) {
    if (item.dataset.endpoint === endpoint) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  }
  query('#title').textContent = ENDPOINTS[endpoint].title;
  query('#description').textContent = ENDPOINTS[endpoint].description;
  companiesField.hidden = endpoint !== 'records';
  result.replaceChildren();
  history.replaceState(null, '', `#${endpoint}`);
}

function readKey(): CustomerKey {
  const data = new FormData(form);
  const year = String(data.get('year') ?? '').trim();
  return {
    year: year === '' ? null : Number(year),
    documentType: data.get('documentType') as DocumentType,
    document: String(data.get('document') ?? '').trim(),
  };
}

function readCompanies(): string[] {
  return companiesInput.value.split(/[\s,;]+/).filter(Boolean);
}

/** Formata 14 posições como XX.XXX.XXX/XXXX-XX (vale também para o CNPJ alfanumérico). */
function formatCnpj(cnpj: string): string {
  return cnpj.length === 14
    ? `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
    : cnpj;
}

async function run(action: () => Promise<void>): Promise<void> {
  submitButton.disabled = true;
  fillCompaniesButton.disabled = true;
  result.replaceChildren(el('p', { className: 'muted' }, 'Consultando…'));
  try {
    await action();
  } catch (error) {
    renderError(error);
  } finally {
    submitButton.disabled = false;
    fillCompaniesButton.disabled = false;
  }
}

function renderError(error: unknown): void {
  const title = error instanceof ApiError
    ? (ERROR_TITLES[error.status] ?? `Erro HTTP ${error.status}`)
    : 'Erro inesperado';
  const detail = error instanceof Error ? translateApiMessage(error.message) : String(error);
  result.replaceChildren(
    el('div', { className: 'alert', role: 'alert' }, el('strong', {}, title), el('p', {}, detail)),
  );
}

function renderCompanies(companies: string[]): void {
  if (companies.length === 0) {
    result.replaceChildren(el('p', { className: 'muted' }, 'Nenhuma empresa ligada a este cliente.'));
    return;
  }
  const viewRecords = el('button', { type: 'button', className: 'link' }, 'Ver registros destas empresas');
  viewRecords.addEventListener('click', () => {
    selectEndpoint('records');
    companiesInput.value = companies.join('\n');
    form.requestSubmit();
  });
  result.replaceChildren(
    el(
      'div',
      { className: 'card' },
      el('h2', {}, `${companies.length} ${companies.length === 1 ? 'empresa' : 'empresas'}`),
      el('ul', { className: 'company-list' }, ...companies.map((cnpj) => el('li', {}, formatCnpj(cnpj)))),
      viewRecords,
    ),
  );
}

function renderRecords(groups: CompanyRecords[]): void {
  result.replaceChildren(...groups.map(renderCompanyRecords));
}

function renderCompanyRecords(group: CompanyRecords): HTMLElement {
  const count = group.records.length;
  const header = el(
    'div',
    { className: 'card-header' },
    el('h2', {}, formatCnpj(group.company)),
    el('span', { className: count === 0 ? 'badge empty' : 'badge' }, `${count} ${count === 1 ? 'registro' : 'registros'}`),
  );
  if (count === 0) {
    return el('div', { className: 'card' }, header, el('p', { className: 'muted' }, 'Sem vínculo entre este cliente e a empresa.'));
  }
  const head = el('tr', {}, ...['ID', 'Produto', 'Valor', 'Atualizado em'].map((label) => el('th', {}, label)));
  const table = el(
    'table',
    {},
    el('thead', {}, head),
    el('tbody', {}, ...group.records.map(renderRecordRow)),
  );
  return el('div', { className: 'card' }, header, el('div', { className: 'table-wrap' }, table));
}

function renderRecordRow(record: RecordItem): HTMLTableRowElement {
  return el(
    'tr',
    {},
    el('td', {}, String(record.id)),
    el('td', {}, record.product),
    el('td', { className: 'number' }, currency.format(record.amount)),
    el('td', {}, dateTime.format(new Date(record.updatedAt))),
  );
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void run(async () => {
    if (current === 'companies') {
      const response = await findCompanies(readKey());
      renderCompanies(response.companies);
    } else {
      const response = await findRecords({ ...readKey(), companies: readCompanies() });
      renderRecords(response.companies);
    }
  });
});

// Atalho do endpoint 2: preenche a lista de CNPJs consultando o endpoint 1 com a mesma chave.
fillCompaniesButton.addEventListener('click', () => {
  void run(async () => {
    const response = await findCompanies(readKey());
    companiesInput.value = response.companies.join('\n');
    if (response.companies.length === 0) {
      result.replaceChildren(el('p', { className: 'muted' }, 'Nenhuma empresa ligada a este cliente.'));
    } else {
      result.replaceChildren();
    }
  });
});

for (const item of menuItems) {
  item.addEventListener('click', () => selectEndpoint(item.dataset.endpoint as Endpoint));
}

selectEndpoint(location.hash === '#records' ? 'records' : 'companies');
