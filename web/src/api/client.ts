// The only way the front end talks to the back end: a client typed by the generated schema.
import createClient from "openapi-fetch";
import type { paths } from "./schema";

export const api = createClient<paths>({ baseUrl: "" });
