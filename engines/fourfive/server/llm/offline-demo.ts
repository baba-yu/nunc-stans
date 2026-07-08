import type { ChatMessage } from '../../shared/types'
import type { Blueprint } from '../../shared/blueprint'

// The offline demo (moved verbatim from the retired MockProvider at T5 —
// product logic, not provider glue): a canned, schema-valid invoice
// blueprint plus demo chat text, so the UI is fully usable with no model
// and no network. The nunc-ai `mock` provider carries the chat side via
// the responder below; the blueprint side short-circuits in the glue.

const INVOICE_BLUEPRINT: Blueprint = {
  app: { name: 'Invoice App', description: 'An app to create and manage customer invoices' },
  mock_ui: {
    screens: [
      {
        id: 'invoice_create',
        name: 'Create Invoice',
        fields: [
          { id: 'customer_name', label: 'Customer Name', type: 'text', maps_to: ['customers.name'], required: true, description: 'Name of the customer being billed' },
          { id: 'issue_date', label: 'Issue Date', type: 'date', maps_to: ['invoices.issue_date'], required: true },
          { id: 'due_date', label: 'Due Date', type: 'date', maps_to: ['invoices.due_date'] },
          { id: 'tax_rate', label: 'Tax Rate', type: 'select', options: ['0.08', '0.10'], maps_to: ['invoices.tax_rate'], description: 'Applicable consumption tax rate' },
          { id: 'item_description', label: 'Item', type: 'text', maps_to: ['invoice_items.description'] },
          { id: 'quantity', label: 'Quantity', type: 'number', maps_to: ['invoice_items.quantity'] },
          { id: 'unit_price', label: 'Unit Price', type: 'number', maps_to: ['invoice_items.unit_price'] },
          { id: 'notes', label: 'Notes', type: 'textarea', maps_to: ['invoices.notes'] },
        ],
      },
    ],
  },
  entities: [
    {
      name: 'customers',
      description: 'The customer being billed',
      columns: [
        { name: 'id', type: 'TEXT', pk: true },
        { name: 'name', type: 'TEXT', nullable: false, description: 'Customer name' },
        { name: 'email', type: 'TEXT', nullable: true },
        { name: 'created_at', type: 'TEXT' },
      ],
    },
    {
      name: 'invoices',
      description: 'Invoice header',
      columns: [
        { name: 'id', type: 'TEXT', pk: true },
        { name: 'customer_id', type: 'TEXT', fk: 'customers.id' },
        { name: 'issue_date', type: 'TEXT' },
        { name: 'due_date', type: 'TEXT', nullable: true },
        { name: 'tax_rate', type: 'REAL' },
        { name: 'tax_amount', type: 'INTEGER' },
        { name: 'total_amount', type: 'INTEGER' },
        { name: 'status', type: 'TEXT', description: 'draft / sent / paid / overdue' },
        { name: 'notes', type: 'TEXT', nullable: true },
      ],
    },
    {
      name: 'invoice_items',
      description: 'Invoice line item',
      columns: [
        { name: 'id', type: 'TEXT', pk: true },
        { name: 'invoice_id', type: 'TEXT', fk: 'invoices.id' },
        { name: 'description', type: 'TEXT' },
        { name: 'quantity', type: 'INTEGER' },
        { name: 'unit_price', type: 'INTEGER' },
        { name: 'line_total', type: 'INTEGER' },
      ],
    },
  ],
  business_logic: [
    { id: 'calc_line_total', name: 'Calculate line subtotal', inputs: ['quantity', 'unit_price'], outputs: ['line_total'], related_db: ['invoice_items.quantity', 'invoice_items.unit_price', 'invoice_items.line_total'], related_api: ['POST /invoices'], description: 'line_total = quantity × unit_price' },
    { id: 'calc_tax', name: 'Calculate tax amount', inputs: ['subtotal', 'tax_rate'], outputs: ['tax_amount'], related_db: ['invoices.tax_rate', 'invoices.tax_amount'], related_api: ['POST /invoices'], description: 'tax_amount = subtotal × tax_rate' },
    { id: 'calc_total', name: 'Calculate total amount', inputs: ['subtotal', 'tax_amount'], outputs: ['total_amount'], related_db: ['invoices.total_amount'], related_api: ['POST /invoices'], description: 'total_amount = subtotal + tax_amount' },
  ],
  terminology: [
    { term: 'Invoice', definition: 'A document requesting payment from a customer', aliases: ['invoice', 'Bill'], related_objects: ['invoices', 'POST /invoices'], status: 'confirmed' },
    { term: 'Line item', definition: 'Each item row on an invoice', aliases: ['line item', 'invoice_item'], related_objects: ['invoice_items'], status: 'confirmed' },
    { term: 'Tax rate', definition: 'The consumption tax rate applied to the billed amount', aliases: ['tax rate'], related_objects: ['invoices.tax_rate'], status: 'tentative' },
  ],
  apis: [
    { method: 'POST', path: '/invoices', summary: 'Create an invoice', related_db: ['invoices', 'invoice_items', 'customers'], related_ui: ['invoice_create'] },
    { method: 'GET', path: '/invoices/:id', summary: 'Get an invoice', related_db: ['invoices', 'invoice_items'], related_ui: [] },
  ],
  open_questions: ['Is tax applied per line item or per invoice?', 'Are customers pre-registered, or entered on the fly?'],
  state_transitions: [
    { subject: 'invoices.status', from: 'draft', to: 'sent', trigger: 'Issue invoice', description: 'Sent to the customer' },
    { subject: 'invoices.status', from: 'sent', to: 'paid', trigger: 'Payment confirmed' },
    { subject: 'invoices.status', from: 'sent', to: 'overdue', trigger: 'Past due date' },
    { subject: 'invoices.status', from: 'overdue', to: 'paid', trigger: 'Payment confirmed' },
  ],
  metrics: [
    { name: 'outstanding_total', label: 'Outstanding total', sql: "SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status != 'paid'" },
    { name: 'overdue_count', label: 'Overdue invoices', sql: "SELECT COUNT(*) FROM invoices WHERE status = 'overdue'" },
  ],
  stories: [
    { id: 'st-1', title: 'Bill a customer', scenario: 'Create an invoice with line items and send it; the outstanding total reflects it.' },
  ],
}


// Matches invoice-shaped prompts in English or Japanese, so the offline
// demo triggers regardless of the language the user types in.
const INVOICE_RE = /invoice|bill|請求|インボイス/i

const looksInvoice = (messages: ChatMessage[]): boolean =>
  INVOICE_RE.test(messages.filter((m) => m.role !== 'system').map((m) => m.content).join(' '))

/** Canned chat reply — plugs into nunc-ai's mock provider as `responder`.
 * Doubles as the SCRIPTED JUDGE (S-6): a goal-verify judge call under
 * the mock provider gets a deterministic never-met verdict, so the
 * loop's mechanics run to max_iters with zero live tokens. */
export function demoResponder(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const text = (lastUser?.content ?? '').trim()
  if (text.startsWith('You are a strict goal judge.')) {
    return JSON.stringify({ met: false, gaps: ['scripted never-met verdict (offline judge)'] })
  }
  const lines = [
    'This is a mock LLM response (for offline testing with no external connection).',
    '',
    `Received requirement: "${text.slice(0, 200)}${text.length > 200 ? '…' : ''}"`,
  ]
  if (looksInvoice(messages)) {
    lines.push('', 'Generated design data for an invoice app. Check the tabs in the right pane (Mock UI / ERD / Logic / API / Terminology).')
  } else {
    lines.push('', 'Tip: write something like "I want to build an invoice app" and the mock will generate a full set of design data.')
  }
  lines.push('', 'To switch to a real model, pick a profile on the Profiles screen (this is the offline fallback).')
  return lines.join('\n')
}

/** Scripted thinking for the demo stream (shown when Thinking is on). */
export const DEMO_THINKING =
  '(thinking) Reviewing the requirements. For an invoice app, it looks like we need customers / invoices / invoice_items and tax calculation.'

/** The blueprint step for the offline profile: the canned invoice
 * blueprint once the conversation looks invoice-shaped, else null. */
export function proposeDemoBlueprint(history: ChatMessage[]): unknown {
  return looksInvoice(history) ? INVOICE_BLUEPRINT : null
}
