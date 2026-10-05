import { createVercelHandler, processEnvironment } from "../server/vercel.ts";
export default {
  fetch: createVercelHandler(processEnvironment, "analyze-body-photos"),
};
