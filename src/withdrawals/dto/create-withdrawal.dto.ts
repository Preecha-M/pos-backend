import { IsOptional, IsString, IsInt, IsArray, ValidateNested, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class WithdrawalItemDto {
  @IsString()
  ingredient_id: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateWithdrawalDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WithdrawalItemDto)
  items: WithdrawalItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
