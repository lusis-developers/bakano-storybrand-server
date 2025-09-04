import express, { Application } from "express";
import authRouter from './auth.route';
import userRouter from './user.route';
import businessRouter from './business.route';
import brandscriptRouter from './brandscript.route';
import contentRouter from './content.route';
import onboardingRouter from './onboarding.router';
import storybrandAccountRouter from './storybrand-account.route';

function routerApi(app: Application) {
  const router = express.Router();
  app.use("/api", router);

  router.use("/auth", authRouter);
  router.use("/users", userRouter);
  router.use("/business", businessRouter);
  router.use("/brandscripts", brandscriptRouter);
  router.use("/content", contentRouter);
  router.use("/onboarding", onboardingRouter);
  router.use("/storybrand-account", storybrandAccountRouter);
}

export default routerApi;
