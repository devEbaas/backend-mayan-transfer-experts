import { ApiProperty } from '@nestjs/swagger';

export class PaymentIntentEntity {
  @ApiProperty({
    description: 'Stripe PaymentIntent client secret for <PaymentElement>',
  })
  clientSecret: string;

  @ApiProperty({ description: 'Internal Payment record id' })
  paymentId: string;

  constructor(partial: PaymentIntentEntity) {
    Object.assign(this, partial);
  }
}
