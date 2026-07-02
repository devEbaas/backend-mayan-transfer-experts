import { UnprocessableEntityException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

export const BOOKING_STATUS_TRANSITIONS: Record<
  BookingStatus,
  BookingStatus[]
> = {
  [BookingStatus.nueva]: [
    BookingStatus.pendiente_pago,
    BookingStatus.cancelada,
  ],
  [BookingStatus.pendiente_pago]: [
    BookingStatus.confirmada,
    BookingStatus.cancelada,
  ],
  [BookingStatus.confirmada]: [BookingStatus.proxima, BookingStatus.cancelada],
  [BookingStatus.proxima]: [BookingStatus.en_curso, BookingStatus.cancelada],
  [BookingStatus.en_curso]: [BookingStatus.finalizada],
  [BookingStatus.finalizada]: [],
  [BookingStatus.cancelada]: [],
};

export function assertValidBookingTransition(
  current: BookingStatus,
  next: BookingStatus,
): void {
  if (!BOOKING_STATUS_TRANSITIONS[current].includes(next)) {
    throw new UnprocessableEntityException(
      `Cannot transition booking from "${current}" to "${next}"`,
    );
  }
}
