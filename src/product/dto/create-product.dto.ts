/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class PackagingDto {
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

class CreateSkuDto {
  @IsNumber()
  price!: number;

  @IsInt()
  @Min(0)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @IsOptional()
  @IsString()
  image?: string | null;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  images!: string[];

  @ValidateNested()
  @Type(() => PackagingDto)
  packaging!: PackagingDto;

  @IsString()
  @IsNotEmpty()
  shippingType!: string;

  @IsIn(['DRAFT', 'PUBLISHED'])
  status!: 'DRAFT' | 'PUBLISHED';

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateSkuDto)
  skus!: CreateSkuDto[];
}

export { PackagingDto, CreateSkuDto };
