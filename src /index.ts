import dotenv from "dotenv";
const env = process.env.NODE_ENV || "local";
dotenv.config({ path: `${__dirname}/../.env` });
import helmet from "helmet";
import morgan from "morgan";
import bodyParser from "body-parser";
import compression from "compression";
import express, { Router, Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import { requestHandler } from "./requestHandler";
import { toElasticSearchQuery, extractElasticResult } from "./utils";
import { Dictionary } from "lodash";

const URL = process.env.URL;
const SEARCH_URL = process.env.URL + "/search";
const defaultHeaders = { "api-key": process.env.API_KEY };

const router = Router();

// Health check endpoint for Kubernetes liveness probe.
router.get("/", async (_, res) => res.sendStatus(200));

interface DefaultQuery {
  successfulDS: string;
  notFoundDS: string;
  varKey: string;
}

interface DefaultRequest extends Request {
  query: DefaultQuery;
}

interface PresenterRequest extends Request {
  query: { name: string } & DefaultQuery;
}

/**
 * Presenters
 * - Query persenters by name to search a presenter and it's attributes.
 */
router.get("/presenters", async ({ query }: PresenterRequest, res, next) => {
  if (!query.name) return next(new Error());
  try {
    const [result] = extractElasticResult(
      await requestHandler("post", {
        url: SEARCH_URL,
        body: toElasticSearchQuery("presenters", { name: query.name }),
        headers: defaultHeaders
      })
    );
    const { id, name, field_values } = await requestHandler("get", {
      url: `${URL}/presenters/${result.id}`,
      headers: defaultHeaders
    });
    return res.json({
      action: { nextDialogstate: query.successfulDS },
      session: { namespace: query.varKey, data: { id, name, ...field_values } }
    });
  } catch (e) {
    next(e);
  }
});

interface Program {
  id: number;
  title: string;
  description: string;
  short_name: string;
  medium_name: string;
  field_values: Dictionary<string>;
}

interface ProgramRequest extends Request {
  query: { title: string } & DefaultQuery;
}

/**
 * Programs
 * - Query program based by the presenter or by title
 */
router.get("/programs", async ({ query }: ProgramRequest, res, next) => {
  try {
    if (!query.title) return next(new Error());
    const [result] = extractElasticResult(
      await requestHandler("post", {
        url: SEARCH_URL,
        body: toElasticSearchQuery("programs", { title: query.title }, {}),
        headers: defaultHeaders
      })
    );
    const program = await requestHandler<Program>("get", {
      url: `${URL}/programs/${result.id}`,
      headers: defaultHeaders
    });
    if (!program) return next(new Error());
    const { id, title, description, short_name, medium_name, field_values } = program;
    return res.json({
      action: { nextDialogstate: query.successfulDS },
      session: {
        namespace: query.varKey,
        data: { id, title, description, short_name, medium_name, ...field_values }
      }
    });
  } catch (e) {
    next(e);
  }
});

interface BroadcastRequest extends Request {
  query: { presenter: string } & DefaultQuery;
}
/**
 * Broadcasts
 * - Query broadcasts by presenter
 * - Or query all available broadcasts.
 */
router.get("/broadcasts", async ({ query }: BroadcastRequest, res, next) => {
  try {
    const options = query.presenter ? { filter: [{ match: { "presenters.name": query.presenter } }] } : {};
    const broadcasts = extractElasticResult(
      await requestHandler("post", {
        url: SEARCH_URL,
        body: toElasticSearchQuery("broadcasts", {}, options),
        headers: defaultHeaders
      })
    );
    if (!broadcasts || broadcasts.length === 0) return next(new Error());
    return res.json({
      action: { nextDialogstate: query.successfulDS },
      session: { namespace: query.varKey, data: broadcasts }
    });
  } catch (e) {
    next(e);
  }
});

// Get the current playing broadcast.
router.get("/broadcasts/current", async ({ query }: DefaultRequest, res, next) => {
  try {
    const {
      presenters: { href },
      ...broadcast
    } = await requestHandler("get", { url: `${URL}/broadcasts/current`, headers: defaultHeaders });
    const url = href.includes(URL) ? href.replace(URL, "") : href.split("/api/v2")[1];
    const { results } = await requestHandler("get", { url: URL + url, headers: defaultHeaders });
    const presenters = results.map(({ name }: { name: string }) => name);
    return res.json({
      action: { nextDialogstate: query.successfulDS },
      session: { namespace: query.varKey, data: { ...broadcast, presenters } }
    });
  } catch (ex) {
    return next(ex);
  }
});

interface BroadcastNextRequest extends Request {
  query: { title: string } & DefaultQuery;
}

router.get("/broadcasts/next", async ({ query }: BroadcastNextRequest, res, next) => {
  try {
    const {
      presenters: { href },
      ...broadcast
    } = await requestHandler("get", { url: `${URL}/broadcasts/next`, headers: defaultHeaders });
    const url = href.includes(URL) ? href.replace(URL, "") : href.split("/api/v2")[1];
    const { results } = await requestHandler("get", { url: URL + url, headers: defaultHeaders });
    const presenters = results.map(({ name }: { name: string }) => name);
    return res.json({
      action: { nextDialogstate: query.successfulDS },
      session: { namespace: query.varKey, data: { ...broadcast, presenters } }
    });
  } catch (ex) {
    return next(ex);
  }
});

router.get("/songs", async ({ query }: DefaultRequest, res, next) => {
  try {
    const result = await requestHandler("get", { url: `${URL}/items`, headers: defaultHeaders });
    return res.json({
      action: { nextDialogstate: query.successfulDS },
      session: { namespace: query.varKey, data: result }
    });
  } catch (ex) {
    next(ex);
  }
});

interface Song {
  id: number;
  title: string;
  field_values?: { artist?: { first_name?: string } };
}

router.get("/songs/last", async ({ query }: DefaultRequest, res, next) => {
  try {
    const options = {
      size: 1,
      query: { bool: { must: { range: { start: { lte: "now" } } } } },
      sort: [{ start: { order: "desc" } }]
    };
    const [{ id }] = extractElasticResult(
      await requestHandler("post", {
        url: SEARCH_URL,
        body: toElasticSearchQuery("items", {}, options),
        headers: defaultHeaders
      })
    );
    const song: Song = await requestHandler("get", { url: `${URL}/items/${id}`, headers: defaultHeaders });
    if (!song) return next(new Error());
    const { title, field_values = {} } = song;
    return res.json({
      action: { nextDialogstate: query.successfulDS },
      session: { namespace: query.varKey, data: { id: song.id, title, artist: field_values.artist } }
    });
  } catch (e) {
    next(e);
  }
});

router.get("/songs/current", async ({ query }: DefaultRequest, res, next) => {
  try {
    const result = await requestHandler("get", { url: `${URL}/items/current`, headers: defaultHeaders });
    return res.json({
      action: { nextDialogstate: query.successfulDS },
      session: { namespace: query.varKey, data: result }
    });
  } catch (e) {
    next(e);
  }
});

const app = express();
Sentry.init({ dsn: process.env.SENTRY_DSN });
Sentry.withScope(scope => {
  scope.setTag("name", "npo-radiomanager-microservice");
});
app.use(Sentry.Handlers.requestHandler());
app.use(helmet());
app.use(compression());
app.use(morgan("common"));
app.use(bodyParser.text());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/", router);
app.use((err: any, req: DefaultRequest, res: Response, next: NextFunction) => {
  if (err && err.message) {
    console.error(err);
    Sentry.captureException(err);
  }
  if (res.headersSent) return next(err);
  return res.status(200).json({ action: { nextDialogstate: req.query.notFoundDS } });
});
const server = app.listen(+process.env.PORT, () => console.info(`Listening on port ${process.env.PORT}`));
const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("SIGQUIT", shutdown);
