import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CreateStripeIntentDto } from './dto/create-stripe-intent.dto';
import { PaymentIntentEntity } from './entities/payment-intent.entity';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('stripe/intent')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a Stripe PaymentIntent for a booking' })
  @ApiCreatedResponse({ type: PaymentIntentEntity })
  createStripeIntent(
    @Body() dto: CreateStripeIntentDto,
  ): Promise<PaymentIntentEntity> {
    return this.paymentsService.createStripeIntent(dto);
  }

  @Post('stripe/webhook')
  @ApiExcludeEndpoint()
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true }> {
    const event = this.paymentsService.constructStripeEvent(
      req.rawBody,
      signature,
    );
    await this.paymentsService.handleStripeEvent(event);
    return { received: true };
  }
}
