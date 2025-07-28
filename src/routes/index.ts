import express, { Application } from "express";
import auth from './auth.route'
import user from './user.route'
import business from './business.route'

function routerApi(app: Application) {
  const router = express.Router();

  app.use("/api", router);

  router.use("/auth", auth);
  router.use("/users", user);
  router.use("/business", business);
}

export default routerApi;
