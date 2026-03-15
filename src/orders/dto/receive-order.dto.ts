import { IsOptional, IsInt, IsString, IsNumber, IsArray, ValidateNested, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveItemDto {
  @Type(() => Number)
  @IsInt()
  order_item_id: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  received_quantity: number;

  @IsOptional()
  @IsString()
  expire_date?: string;
}

export class ReceiveOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  itemsToReceive: ReceiveItemDto[];

  @IsOptional()
  @IsString()
  goods_receipt_url?: string;

  @IsOptional()
  @IsString()
  tax_invoice_url?: string;
}
