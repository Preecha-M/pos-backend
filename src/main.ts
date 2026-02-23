import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:5173', 'https://dbms-pro-j0lm.onrender.com'],
    credentials: true,
  });

  app.use(cookieParser());
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}
bootstrap();
