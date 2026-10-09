import './style.css';
import {
  ApiError,
  currentSession,
  exportRecords,
  fetchHistory,
  findCompanies,
  findRecords,
  login,
  logout,
  searchRecords,
} from './api';
import { maskCompanies, maskDocument, maxDocumentLength } from './document';
import { translateApiMessage } from './messages';
import type {
  AuditAction,
  AuditOutcome,
  CompanyRecords,
  CustomerKey,
  DocumentType,
  HistoryItem,
  RecordItem,
  SearchItem,
  SearchRequest,
  SearchTotals,
  SessionResponse,
} from './types';

type Endpoint = 'companies' | 'records' | 'search';

const ENDPOINTS: Record<Endpoint, { title: string; description: string }> = {
  companies: {
    title: 'Empresas do cliente',
    description: 'POST /api/v1/customers/companies: devolve os CNPJs das empresas ligadas à chave do cliente.',
  },
  records: {
    title: 'Registros por empresa',
    description: 'POST /api/v1/customers/records: devolve os registros do cliente em cada empresa (até 100).',
  },
  search: {
    title: 'Busca e exportação',
    description:
      'POST /api/v1/customers/search: filtra por empresa, produto e período, pagina por cursor e soma os totais. '
      + 'A exportação traz até 5.000 linhas em CSV ou Excel.',
  },
};

// Títulos dos erros por status; o detalhe vem da API, traduzido em messages.ts.
const ERROR_TITLES: Record<number, string> = {
  0: 'Erro de rede',
  400: 'Dados inválidos',
  401: 'Sessão expirada',
  403: 'Acesso negado',
  429: 'Muitas requisições',
  500: 'Erro inesperado',
  503: 'Serviço indisponível',
};

const ACTIONS: Record<AuditAction, string> = {
  COMPANIES: 'Empresas do cliente',
  RECORDS: 'Registros por empresa',
  SEARCH: 'Busca',
  EXPORT_CSV: 'Exportação CSV',
  EXPORT_XLSX: 'Exportação Excel',
};

const OUTCOMES: Record<AuditOutcome, { label: string; className: string }> = {
  SUCCESS: { label: 'concluída', className: 'badge' },
  REJECTED: { label: 'dado inválido', className: 'badge empty' },
  FAILED: { label: 'falhou', className: 'badge error' },
};

const PAGE_SIZE = 50;
const EXPORT_SCOPE = 'customers:export';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const integer = new Intl.NumberFormat('pt-BR');

const loginView = query<HTMLElement>('#login-view');
const appShell = query<HTMLElement>('#app-shell');
const loginForm = query<HTMLFormElement>('#login-form');
const loginButton = query<HTMLButtonElement>('#login-form button[type="submit"]');
const loginError = query<HTMLElement>('#login-error');
const logoutButton = query<HTMLButtonElement>('#logout');

const form = query<HTMLFormElement>('#query-form');
const submitButton = query<HTMLButtonElement>('#query-form button[type="submit"]');
const companiesField = query<HTMLDivElement>('#companies-field');
const companiesInput = query<HTMLTextAreaElement>('#companies');
const fillCompaniesButton = query<HTMLButtonElement>('#fill-companies');
const filtersField = query<HTMLDivElement>('#filters-field');
const exportActions = query<HTMLElement>('#export-actions');
const exportCsv = query<HTMLButtonElement>('#export-csv');
const exportXlsx = query<HTMLButtonElement>('#export-xlsx');
const result = query<HTMLElement>('#result');
const historyList = query<HTMLElement>('#history-list');
const menuItems = Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-item'));

let current: Endpoint = 'companies';
let session: SessionResponse | null = null;

// Estado da busca: o pedido da primeira página e os itens já carregados, para o "Carregar mais".
let search: { request: SearchRequest; items: SearchItem[]; totals: SearchTotals; nextCursor: string | null } | null = null;

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

function showApplication(active: SessionResponse | null): void {
  session = active;
  loginView.hidden = active !== null;
  appShell.hidden = active === null;
  if (active === null) {
    historyList.replaceChildren();
    query<HTMLInputElement>('#username').focus();
    return;
  }
  selectEndpoint(current);
  void loadHistory();
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);
  loginButton.disabled = true;
  loginError.hidden = true;
  void login({
    username: String(data.get('username') ?? '').trim(),
    password: String(data.get('password') ?? ''),
  })
    .then((active) => {
      loginForm.reset();
      showApplication(active);
    })
    .catch((error: unknown) => {
      loginError.textContent = error instanceof ApiError && (error.status === 401 || error.status === 400)
        ? translateApiMessage(error.message)
        : 'Não foi possível entrar. Tente novamente.';
      loginError.hidden = false;
    })
    .finally(() => {
      loginButton.disabled = false;
    });
});

logoutButton.addEventListener('click', () => {
  void logout().finally(() => showApplication(null));
});

window.addEventListener('auth:expired', () => showApplication(null));

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
  companiesField.hidden = endpoint === 'companies';
  companiesInput.placeholder = endpoint === 'search' ? 'Opcional: vazio = todas as empresas do cliente' : '';
  filtersField.hidden = endpoint !== 'search';
  exportActions.hidden = endpoint !== 'search' || !session?.scopes.includes(EXPORT_SCOPE);
  search = null;
  result.replaceChildren();
  // Guarda o endpoint no endereço só quando ele não aponta para uma seção da página (#parceiros, #insights...).
  if (['', '#companies', '#records', '#search'].includes(location.hash)) {
    history.replaceState(null, '', `#${endpoint}`);
  }
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

// As datas do formulário são dias inteiros no horário de Brasília (o dia começa às 03:00 UTC).
function readSearch(): SearchRequest {
  const data = new FormData(form);
  const from = String(data.get('updatedFrom') ?? '');
  const to = String(data.get('updatedTo') ?? '');
  return {
    ...readKey(),
    companies: readCompanies(),
    product: String(data.get('product') ?? '').trim() || undefined,
    updatedFrom: from ? new Date(`${from}T00:00:00-03:00`).toISOString() : undefined,
    updatedTo: to ? new Date(`${to}T23:59:59.999-03:00`).toISOString() : undefined,
    limit: PAGE_SIZE,
  };
}

function setBusy(busy: boolean): void {
  for (const button of [submitButton, fillCompaniesButton, exportCsv, exportXlsx]) {
    button.disabled = busy;
  }
}

async function run(action: () => Promise<void>, showProgress = true): Promise<void> {
  setBusy(true);
  if (showProgress) {
    result.replaceChildren(el('p', { className: 'muted' }, 'Consultando…'));
  }
  try {
    await action();
  } catch (error) {
    renderError(error);
  } finally {
    setBusy(false);
    void loadHistory();
  }
}

// Status desconhecido (ex.: 404 de um proxy) nunca aparece como código técnico: vira uma mensagem genérica.
function renderError(error: unknown): void {
  const known = error instanceof ApiError && error.status in ERROR_TITLES;
  const title = known ? ERROR_TITLES[error.status] : 'Não foi possível concluir a consulta';
  const detail = known ? translateApiMessage(error.message) : 'Tente novamente em instantes.';
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
    companiesInput.value = maskCompanies(companies.join('\n'));
    form.requestSubmit();
  });
  result.replaceChildren(
    el(
      'div',
      { className: 'card' },
      el('h2', {}, `${companies.length} ${companies.length === 1 ? 'empresa' : 'empresas'}`),
      el('ul', { className: 'company-list' }, ...companies.map((cnpj) => el('li', {}, maskDocument(cnpj, 'CNPJ')))),
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
    el('h2', {}, maskDocument(group.company, 'CNPJ')),
    el('span', { className: count === 0 ? 'badge empty' : 'badge' }, `${count} ${count === 1 ? 'registro' : 'registros'}`),
  );
  if (count === 0) {
    return el('div', { className: 'card' }, header, el('p', { className: 'muted' }, 'Sem vínculo entre este cliente e a empresa.'));
  }
  const head = el('tr', {}, ...['ID', 'Produto', 'Valor', 'Atualizado em'].map((label) => el('th', {}, label)));
  const table = el('table', {}, el('thead', {}, head), el('tbody', {}, ...group.records.map(renderRecordRow)));
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

function metric(value: string, label: string): HTMLElement {
  return el('div', {}, el('strong', {}, value), el('span', {}, label));
}

function renderSearch(): void {
  if (!search) {
    return;
  }
  const { items, totals, nextCursor } = search;
  const summary = el(
    'div',
    { className: 'summary-grid' },
    metric(`${integer.format(items.length)} de ${integer.format(totals.records)}`, 'Registros exibidos'),
    metric(integer.format(totals.companies), totals.companies === 1 ? 'Empresa' : 'Empresas'),
    metric(currency.format(totals.amount), 'Valor total do filtro'),
  );
  if (items.length === 0) {
    result.replaceChildren(summary, el('p', { className: 'muted' }, 'Nenhum registro atende aos filtros.'));
    return;
  }
  const head = el('tr', {}, ...['Empresa', 'ID', 'Produto', 'Valor', 'Atualizado em'].map((label) => el('th', {}, label)));
  const rows = items.map((item) =>
    el(
      'tr',
      {},
      el('td', {}, maskDocument(item.company, 'CNPJ')),
      el('td', {}, String(item.id)),
      el('td', {}, item.product),
      el('td', { className: 'number' }, currency.format(item.amount)),
      el('td', {}, dateTime.format(new Date(item.updatedAt))),
    ),
  );
  const table = el('div', { className: 'card table-wrap' }, el('table', {}, el('thead', {}, head), el('tbody', {}, ...rows)));
  const children: Node[] = [summary, table];
  if (nextCursor) {
    const more = el('button', { type: 'button', className: 'secondary load-more' }, 'Carregar mais');
    more.addEventListener('click', () => void loadMore(more));
    children.push(more);
  }
  result.replaceChildren(...children);
}

async function loadMore(button: HTMLButtonElement): Promise<void> {
  if (!search?.nextCursor) {
    return;
  }
  button.disabled = true;
  button.textContent = 'Carregando…';
  const state = search;
  await run(async () => {
    const page = await searchRecords({ ...state.request, cursor: state.nextCursor ?? undefined });
    search = { ...state, items: [...state.items, ...page.items], totals: page.totals, nextCursor: page.nextCursor };
    renderSearch();
  }, false);
}

function renderHistory(items: HistoryItem[]): void {
  if (items.length === 0) {
    historyList.replaceChildren(el('p', { className: 'muted' }, 'Nenhuma consulta ainda.'));
    return;
  }
  historyList.replaceChildren(
    ...items.map((item) => {
      const outcome = OUTCOMES[item.outcome] ?? OUTCOMES.FAILED;
      const results = `${integer.format(item.resultCount)} ${item.resultCount === 1 ? 'resultado' : 'resultados'}`;
      return el(
        'div',
        { className: 'history-item' },
        el(
          'div',
          {},
          el('strong', {}, ACTIONS[item.action] ?? item.action),
          el('small', {}, ` · ${item.year} · ${item.documentType} ${item.document}`),
        ),
        el(
          'div',
          { className: 'history-meta' },
          el('span', { className: outcome.className }, outcome.label),
          el('small', {}, `${results} · ${item.durationMs} ms · ${dateTime.format(new Date(item.at))}`),
        ),
      );
    }),
  );
}

async function loadHistory(): Promise<void> {
  if (!session) {
    return;
  }
  try {
    renderHistory((await fetchHistory()).items);
  } catch {
    historyList.replaceChildren(el('p', { className: 'muted' }, 'Histórico indisponível no momento.'));
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void run(async () => {
    if (current === 'companies') {
      renderCompanies((await findCompanies(readKey())).companies);
    } else if (current === 'records') {
      renderRecords((await findRecords({ ...readKey(), companies: readCompanies() })).companies);
    } else {
      const request = readSearch();
      const page = await searchRecords(request);
      search = { request, items: page.items, totals: page.totals, nextCursor: page.nextCursor };
      renderSearch();
    }
  });
});

// Atalho: preenche a lista de CNPJs consultando o endpoint 1 com a mesma chave.
fillCompaniesButton.addEventListener('click', () => {
  void run(async () => {
    const response = await findCompanies(readKey());
    companiesInput.value = maskCompanies(response.companies.join('\n'));
    if (response.companies.length === 0) {
      result.replaceChildren(el('p', { className: 'muted' }, 'Nenhuma empresa ligada a este cliente.'));
    } else {
      result.replaceChildren();
    }
  });
});

for (const [button, format] of [[exportCsv, 'csv'], [exportXlsx, 'xlsx']] as const) {
  button.addEventListener('click', () =>
    void run(async () => {
      const { truncated } = await exportRecords(readSearch(), format);
      result.replaceChildren(
        el(
          'p',
          { className: 'muted' },
          truncated
            ? 'Arquivo baixado com as primeiras 5.000 linhas. Refine os filtros para exportar o restante.'
            : 'Arquivo baixado.',
        ),
      );
    }, false),
  );
}

// Máscaras: o campo nunca aceita mais caracteres do que o documento do tipo escolhido.
const documentInput = query<HTMLInputElement>('input[name="document"]');
const documentTypeSelect = query<HTMLSelectElement>('select[name="documentType"]');
const yearInput = query<HTMLInputElement>('input[name="year"]');

function applyDocumentMask(): void {
  const type = documentTypeSelect.value as DocumentType;
  documentInput.maxLength = maxDocumentLength(type);
  documentInput.placeholder = type === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00';
  documentInput.value = maskDocument(documentInput.value, type);
}

documentInput.addEventListener('input', applyDocumentMask);
documentTypeSelect.addEventListener('change', applyDocumentMask);
yearInput.addEventListener('input', () => {
  yearInput.value = yearInput.value.replace(/\D/g, '').slice(0, 4);
});
companiesInput.addEventListener('blur', () => {
  companiesInput.value = maskCompanies(companiesInput.value);
});
applyDocumentMask();

for (const item of menuItems) {
  item.addEventListener('click', () => selectEndpoint(item.dataset.endpoint as Endpoint));
}

// Imagem de parceiro ausente some, em vez de aparecer quebrada (sem onerror inline, que a CSP bloqueia).
for (const image of document.querySelectorAll<HTMLImageElement>('.partner img')) {
  image.addEventListener('error', () => image.classList.add('image-missing'));
}

const initial = location.hash.slice(1);
current = initial === 'records' || initial === 'search' ? initial : 'companies';
loginView.hidden = true;
void currentSession().then(showApplication);
