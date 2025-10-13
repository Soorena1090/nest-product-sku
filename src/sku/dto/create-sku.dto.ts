/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';

export class CreateSkuDto {
  @IsNumber()
  @Min(0)
  price!: number;

  @IsInt()
  @Min(0)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @IsString()
  @IsNotEmpty()
  image!: string;

  @IsString()
  @IsMongoId()
  productId!: string;
}
