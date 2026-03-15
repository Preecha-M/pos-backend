import { IsOptional, IsInt, IsString, IsNumber, IsArray, ValidateNested, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsString()
  ingredient_id: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unit_cost?: number;
}

export class CreateOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplier_id?: number;

  @IsOptional()
  @IsString()
  delivery_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  credit_days?: number;

  @IsOptional()
  @IsString()
  payment_terms?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  subtotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tax_rate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tax_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  total_amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  document_url?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
