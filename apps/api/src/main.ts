import * as fs from 'fs';
import * as path from 'path';

// Tự động tải các biến môi trường từ file .env theo các đường dẫn tương ứng
function loadEnv() {
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/api/.env'),
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '../..', '.env'),
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const idx = trimmed.indexOf('=');
          if (idx === -1) return;
          const key = trimmed.substring(0, idx).trim();
          let val = trimmed.substring(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        });
        break;
      } catch (e) {
        // Bỏ qua lỗi đọc file
      }
    }
  }
}
loadEnv();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Kích hoạt CORS để cho phép Frontend Next.js gọi API từ cổng khác
  app.enableCors();
  
  // Kích hoạt ValidationPipe toàn cục để tự động kiểm tra định dạng dữ liệu DTO đầu vào
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Loại bỏ các trường thừa không được định nghĩa trong DTO
    transform: true, // Tự động convert kiểu dữ liệu (vd: string -> number)
  }));
  
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`NestJS API đang chạy tại: http://localhost:${port}`);
}
bootstrap();
