const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const express = require('express');

let app;
const server = express();

const createNestApp = async (expressInstance) => {
  if (!app) {
    // Dynamic import to handle dist output after build
    const { AppModule } = require('../dist/src/app.module');
    app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressInstance)
    );
    await app.init();
  }
  return app;
};

module.exports = async (req, res) => {
  await createNestApp(server);
  server(req, res);
};
