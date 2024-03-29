const express = require('express');
const helmet = require('helmet');
const xss = require('xss-clean');
const path = require('path');
const compression = require('compression');
const cors = require('cors');
const passport = require('passport');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const httpStatus = require('http-status');
const cookieParser = require('cookie-parser');
const config = require('./configs/config');
const morgan = require('./configs/morgan');
const { jwtStrategy } = require('./configs/passport');
const { authLimiter } = require('./middlewares/rateLimiter');
const apiRoutes = require('./routes/api-v1/index');
const routes = require('./routes/production/index');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');

const app = express();

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

app.use(express.static(path.join(__dirname, '..', 'public')));

// set security HTTP headers
app.use(helmet());

// setup body-parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// sanitize request data
app.use(xss());

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
app.options('*', cors());

// parse cookies
app.use(cookieParser());

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  app.use('/v1/auth', authLimiter);
}

// v1 api routes
app.use('/v1', apiRoutes);

// production routes
app.use('/', routes);

const swaggerDocument = YAML.load('./cavalry-guilds-docs.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;
