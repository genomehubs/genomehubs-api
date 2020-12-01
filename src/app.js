import { OpenApiValidator } from "express-openapi-validator";
import YAML from "yamljs";
import bodyParser from "body-parser";
import compression from "compression";
import { config } from "./api/v0/functions/config.js";
import cookieParser from "cookie-parser";
import express from "express";
import path from "path";
import swaggerUi from "swagger-ui-express";

const port = config.port;
const apiSpec = path.join(__dirname, "api/v0/api.yaml");

let swaggerDocument = YAML.load(apiSpec);
swaggerDocument.info.description = config.description;
swaggerDocument.info.title = config.title;
swaggerDocument.info.contactName = config.contactName;
swaggerDocument.info.contactEmail = config.contactEmail;
swaggerDocument.servers[0].url = config.url;

const swaggerOptions = {
  customCss:
    ".swagger-ui .topbar, .information-container, .scheme-container { display: none }",
  customSiteTitle: `${config.title} API`,
};

const app = express();
app.use(compression());
if (config.cors) {
  const cors = require("cors");
  app.use(cors(config.cors));
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/api-spec", express.static(apiSpec));
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, swaggerOptions)
);

new OpenApiValidator({
  apiSpec,
  validateRequests: true,
  validateResponses: true,
  operationHandlers: path.join(__dirname),
})
  .install(app)
  .then(() => {
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({
        message: err.message,
        errors: err.errors,
      });
    });

    if (config.https) {
      const https = require("https");
      const fs = require("fs");
      const options = {
        key: fs.readFileSync(config.keyFile),
        cert: fs.readFileSync(config.certFile),
      };
      https.createServer(options, app).listen(port, () => {
        console.log(`Listening on https port ${port}`);
      });
    } else {
      const http = require("http");
      http.createServer(app).listen(port, () => {
        console.log(`Listening on http port ${port}`);
      });
    }
  });

module.exports = app;
