import { OpenApiValidator } from "express-openapi-validator";
import YAML from "yamljs";
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
swaggerDocument.info.version = config.url.replace(/.+\//, "");
swaggerDocument.info.contact.name = config.contactName;
swaggerDocument.info.contact.email = config.contactEmail;
swaggerDocument.servers[0].url = config.url;

const swaggerOptions = {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: `${config.title} API`,
};

const app = express();
app.use(compression());
if (config.cors) {
  const cors = require("cors");
  app.use(cors(config.cors));
}

app.use(express.urlencoded({ extended: true }));
app.use(express.text());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.get("/api-spec", function (req, res) {
  res.header("Content-Type", "text/yaml");
  res.send(YAML.stringify(swaggerDocument, 8, 4));
});
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, swaggerOptions)
);

new OpenApiValidator({
  apiSpec: swaggerDocument,
  validateRequests: true,
  validateResponses: true,
  operationHandlers: path.join(__dirname),
})
  .install(app)
  .then(() => {
    app.use((err, req, res, next) => {
      let error = {
        message: err.message,
        errors: err.errors,
      };
      res.status(err.status || 500).json(error);
      console.log(error);
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
