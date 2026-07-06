import { ApiProperty } from '@nestjs/swagger';

export class CheckoutSessionEntity {
  @ApiProperty({ description: 'URL to redirect the browser to (checkout.stripe.com)' })
  url: string;

  @ApiProperty({ description: 'Stripe Checkout Session id' })
  sessionId: string;

  constructor(partial: CheckoutSessionEntity) {
    Object.assign(this, partial);
  }
}
