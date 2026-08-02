// Computes how much of a cancelled booking is refundable, mirroring the
// published policy table on app/(guest)/refund-policy/page.tsx:
//   - Cancelled more than 24 hours before check-in -> full refund
//   - Cancelled within 24 hours of check-in        -> one-night charge applies
//   - At/after check-in (no-show)                  -> no refund
// Pure function, no DB/network — used by both the guest cancel route (to
// file the RefundRequest) and the guest UI (to preview the outcome).

export type RefundRule = 'FULL' | 'PARTIAL' | 'NONE';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function calculateRefund({
  totalAmount,
  checkIn,
  checkOut,
  cancelledAt,
}: {
  totalAmount: number;
  checkIn: Date;
  checkOut: Date;
  cancelledAt: Date;
}): { rule: RefundRule; amount: number } {
  // At/after check-in — treated as a no-show per policy: nothing refundable
  // through self-service (an admin can still refund manually if they choose).
  if (cancelledAt.getTime() >= checkIn.getTime()) {
    return { rule: 'NONE', amount: 0 };
  }

  // More than 24 hours of notice — the full amount comes back.
  if (checkIn.getTime() - cancelledAt.getTime() > DAY_MS) {
    return { rule: 'FULL', amount: totalAmount };
  }

  // Within 24 hours — "one-night charge applies; remainder refunded".
  // One night is taken as the stay's AVERAGE nightly share of the total
  // (totalAmount / nights): the total already has any discount and tax
  // baked in, so a proportional share is the honest reading of "one-night
  // charge" even when individual nights had different seasonal rates.
  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / DAY_MS));
  const oneNightCharge = totalAmount / nights;
  const amount = Math.round((totalAmount - oneNightCharge) * 100) / 100;

  // A one-night stay cancelled late refunds nothing — same as NONE.
  if (amount <= 0) {
    return { rule: 'NONE', amount: 0 };
  }
  return { rule: 'PARTIAL', amount };
}
