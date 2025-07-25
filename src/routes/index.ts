import express, { Application } from "express";
import auth from './auth.route'

function routerApi(app: Application) {
  const router = express.Router();

  app.use("/api", router);

  router.use("/auth", auth);
}

export default routerApi;
