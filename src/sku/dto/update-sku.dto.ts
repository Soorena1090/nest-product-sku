import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateSkuDto } from './create-sku.dto';

// Update DTO allows updating all fields except productId; all fields are optional
export class UpdateSkuDto extends PartialType(
  OmitType(CreateSkuDto, ['productId'] as const),
) {}
