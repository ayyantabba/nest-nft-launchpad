import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

let app: any;

export default async function handler(req: any, res: any) {
  if (!app) {
    app = await NestFactory.create(AppModule);
    await app.init();
  }
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
}
