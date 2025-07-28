import express, { Application } from "express";
import auth from './auth.route'
import user from './user.route'

function routerApi(app: Application) {
  const router = express.Router();

  app.use("/api", router);

  router.use("/auth", auth);
  router.use("/users", user);
}

export default routerApi;
