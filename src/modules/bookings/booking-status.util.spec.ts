import { BookingStatus } from '@prisma/client';
import { assertValidBookingTransition } from './booking-status.util';

describe('assertValidBookingTransition', () => {
  it('allows the documented happy path', () => {
    expect(() =>
      assertValidBookingTransition(
        BookingStatus.nueva,
        BookingStatus.pendiente_pago,
      ),
    ).not.toThrow();
    expect(() =>
      assertValidBookingTransition(
        BookingStatus.pendiente_pago,
        BookingStatus.confirmada,
      ),
    ).not.toThrow();
    expect(() =>
      assertValidBookingTransition(
        BookingStatus.confirmada,
        BookingStatus.proxima,
      ),
    ).not.toThrow();
    expect(() =>
      assertValidBookingTransition(
        BookingStatus.proxima,
        BookingStatus.en_curso,
      ),
    ).not.toThrow();
    expect(() =>
      assertValidBookingTransition(
        BookingStatus.en_curso,
        BookingStatus.finalizada,
      ),
    ).not.toThrow();
  });

  it('allows cancelling from any active state', () => {
    for (const state of [
      BookingStatus.nueva,
      BookingStatus.pendiente_pago,
      BookingStatus.confirmada,
      BookingStatus.proxima,
    ]) {
      expect(() =>
        assertValidBookingTransition(state, BookingStatus.cancelada),
      ).not.toThrow();
    }
  });

  it('rejects skipping states', () => {
    expect(() =>
      assertValidBookingTransition(
        BookingStatus.nueva,
        BookingStatus.confirmada,
      ),
    ).toThrow('Cannot transition booking from "nueva" to "confirmada"');
  });

  it('rejects transitions out of terminal states', () => {
    expect(() =>
      assertValidBookingTransition(
        BookingStatus.finalizada,
        BookingStatus.nueva,
      ),
    ).toThrow();
    expect(() =>
      assertValidBookingTransition(
        BookingStatus.cancelada,
        BookingStatus.nueva,
      ),
    ).toThrow();
  });
});
