import express from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import bodyParser from "body-parser";
const logger = require("morgan");
import http from "http";
import { OpenApiValidator } from "express-openapi-validator";
import YAML from "yamljs";

const port = 3000;
const app = express();
app.use(cors());
const apiSpec = path.join(__dirname, "api/v0/api.yaml");
const swaggerDocument = YAML.load(apiSpec);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.text());
app.use(bodyParser.json());

// app.use(logger("dev"));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/spec", express.static(apiSpec));

let swaggerOptions = {
  customCss:
    ".swagger-ui .topbar, .information-container, .scheme-container { display: none }",
};

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

    http.createServer(app).listen(port);
    console.log(`Listening on port ${port}`);
  });

module.exports = app;
