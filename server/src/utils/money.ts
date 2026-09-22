import { Prisma } from '@prisma/client';

const D = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(v);

export interface LineCalcInput {
  quantity: number;
  unitPrice: Prisma.Decimal | number | string;
  discountPercent?: Prisma.Decimal | number | string;
  gstPercent?: Prisma.Decimal | number | string;
}

export interface LineCalcResult {
  baseAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  gstAmount: Prisma.Decimal;
  lineAmount: Prisma.Decimal;
}

export const round2 = (d: Prisma.Decimal) => d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export function calcLineAmount(input: LineCalcInput): LineCalcResult {
  const base = D(input.unitPrice).mul(input.quantity);
  const discount = base.mul(D(input.discountPercent ?? 0)).div(100);
  const taxable = base.sub(discount);
  const gst = taxable.mul(D(input.gstPercent ?? 0)).div(100);
  return {
    baseAmount: round2(base),
    discountAmount: round2(discount),
    gstAmount: round2(gst),
    lineAmount: round2(taxable.add(gst)),
  };
}

export function calcGrandTotal(lines: LineCalcResult[]): Prisma.Decimal {
  return round2(lines.reduce((acc, l) => acc.add(l.lineAmount), D(0)));
}
