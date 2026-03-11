import { IsString, IsOptional, IsNumber, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIngredientDto {
  @IsString()
  ingredient_id: string;

  @IsOptional()
  @IsString()
  ingredient_name?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost_per_unit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity_on_hand?: number;

  @IsOptional()
  @IsString()
  category_code?: string;

  @IsOptional()
  @IsString()
  expire_date?: string;
}

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  ingredient_name?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost_per_unit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity_on_hand?: number;

  @IsOptional()
  @IsString()
  category_code?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
