import express from 'express';
const path = require('path');
const cookieParser = require('cookie-parser');
import swaggerUi from 'swagger-ui-express';
const bodyParser = require('body-parser');
const logger = require('morgan');
const http = require('http');
const { OpenApiValidator } = require('express-openapi-validator');
const YAML = require('yamljs');

const port = 3000;
const app = express();
const apiSpec = path.join(__dirname, 'api/v0/api.yaml');
const swaggerDocument = YAML.load(apiSpec);

// 1. Install bodyParsers for the request types your API will support
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.text());
app.use(bodyParser.json());

app.use(logger('dev'));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/spec', express.static(apiSpec));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

//  2. Install the OpenApiValidator on your express app
new OpenApiValidator({
  apiSpec,
  validateRequests: true, // default true
  validateResponses: true, // default false
  // 3. Provide the base path to the operation handlers directory
  operationHandlers: path.join(__dirname), // default false
})
  .install(app)
  .then(() => {
    // 4. Woah sweet! With auto-wired operation handlers, I don't have to declare my routes!
    //    See api.yaml for x-eov-* vendor extensions

    // 5. Create a custom error handler
    app.use((err, req, res, next) => {
      // format errors
      res.status(err.status || 500).json({
        message: err.message,
        errors: err.errors,
      });
    });

    http.createServer(app).listen(port);
    console.log(`Listening on port ${port}`);
  });

module.exports = app;
