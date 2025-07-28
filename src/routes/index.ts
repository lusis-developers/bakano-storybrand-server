import express, { Application } from "express";
import auth from './auth.route'
import user from './user.route'
import business from './business.route'
import brandscript from './brandscript.route'

function routerApi(app: Application) {
  const router = express.Router();

  app.use("/api", router);

  router.use("/auth", auth);
  router.use("/users", user);
  router.use("/business", business);
  router.use("/brandscripts", brandscript);
}

export default routerApi;
