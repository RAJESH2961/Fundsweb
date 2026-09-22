import { prisma, Tx } from '../prisma/client';

const PREFIXES = {
  enquiry: 'ENQ',
  quotation: 'QTN',
  order: 'SO',
  dispatch: 'DSP',
} as const;

type Kind = keyof typeof PREFIXES;

const counters: Record<Kind, (tx: Tx) => Promise<number>> = {
  enquiry: (tx) => tx.enquiry.count(),
  quotation: (tx) => tx.quotation.count(),
  order: (tx) => tx.salesOrder.count(),
  dispatch: (tx) => tx.dispatch.count(),
};

export async function generateNumber(kind: Kind, tx?: Tx): Promise<string> {
  const client = tx ?? prisma;
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await counters[kind](client);
    const candidate = `${PREFIXES[kind]}-${year}-${String(count + 1 + attempt).padStart(5, '0')}`;
    const exists = await existsByNumber(kind, candidate, client);
    if (!exists) return candidate;
  }
  return `${PREFIXES[kind]}-${year}-${Date.now()}`;
}

async function existsByNumber(kind: Kind, num: string, tx: Tx) {
  switch (kind) {
    case 'enquiry':
      return !!(await tx.enquiry.findUnique({ where: { enquiryNumber: num } }));
    case 'quotation':
      return !!(await tx.quotation.findUnique({ where: { quotationNumber: num } }));
    case 'order':
      return !!(await tx.salesOrder.findUnique({ where: { orderNumber: num } }));
    case 'dispatch':
      return !!(await tx.dispatch.findUnique({ where: { dispatchNumber: num } }));
  }
}
