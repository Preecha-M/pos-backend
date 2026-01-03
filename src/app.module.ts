import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DbModule } from './common/db/db.module';
import { SupabaseModule } from './common/supabase/supabase.module';

import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { EmployeesModule } from './employees/employees.module';
import { CategoriesModule } from './categories/categories.module';
import { MenuModule } from './menu/menu.module';
import { UploadModule } from './upload/upload.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { MembersModule } from './members/members.module';
import { PromotionsModule } from './promotions/promotions.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { OrdersModule } from './orders/orders.module';
import { SalesModule } from './sales/sales.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    SupabaseModule,

    HealthModule,
    AuthModule,
    EmployeesModule,
    CategoriesModule,
    MenuModule,
    UploadModule,
    IngredientsModule,
    MembersModule,
    PromotionsModule,
    SuppliersModule,
    OrdersModule,
    SalesModule,
    DashboardModule,
  ],
})
export class AppModule {}
