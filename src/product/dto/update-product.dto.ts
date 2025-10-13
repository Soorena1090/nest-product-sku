/* eslint-disable @typescript-eslint/no-unsafe-call */
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateProductDto } from './create-product.dto';

class UpdatePackagingDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  length?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number | null;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePackagingDto)
  packaging?: UpdatePackagingDto;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  shippingType?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: 'DRAFT' | 'PUBLISHED';
}
