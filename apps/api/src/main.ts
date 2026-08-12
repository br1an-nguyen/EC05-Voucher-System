import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Kích hoạt ValidationPipe toàn cục để tự động kiểm tra định dạng dữ liệu DTO đầu vào
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Loại bỏ các trường thừa không được định nghĩa trong DTO
    transform: true, // Tự động convert kiểu dữ liệu (vd: string -> number)
  }));
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
