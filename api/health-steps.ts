import { createVercelHandler, processEnvironment } from "../server/vercel.ts";
export default {
  fetch: createVercelHandler(processEnvironment, "health-steps"),
};
