if (process.env.NEW_RELIC_LICENSE_KEY && process.env.NEW_RELIC_APP_NAME) {
    require('newrelic');
}

var express = require('express')
  , app = express()
  , core = require('nitrogen-core')
  , server = require('http').createServer(app)
  , BearerStrategy = require('passport-http-bearer').Strategy
  , controllers = require('./controllers')
  , exphbs = require('express-handlebars')
  , hbs = exphbs.create({ defaultLayout: 'main' })
  , LocalStrategy = require('passport-local').Strategy
  , middleware = require('./middleware')
  , mongoose = require('mongoose')
  , passport = require('passport')
  , path = require('path')
  , PublicKeyStrategy = require('passport-publickey').Strategy;

core.config = require('./config');
core.log = require('winston');

var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn(core.config.user_login_path)

// You can use Loggly's log service by specifying these 4 environmental variables
if (process.env.LOGGLY_SUBDOMAIN && process.env.LOGGLY_INPUT_TOKEN &&
    process.env.LOGGLY_USERNAME && process.env.LOGGLY_PASSWORD) {

    core.log.add(Loggly, {
        "subdomain": process.env.LOGGLY_SUBDOMAIN,
        "inputToken": process.env.LOGGLY_INPUT_TOKEN,
        "auth": {
            "username": process.env.LOGGLY_USERNAME,
            "password": process.env.LOGGLY_PASSWORD
        }
    });
}

core.log.remove(core.log.transports.Console);
core.log.add(core.log.transports.Console, { colorize: true, timestamp: true, level: 'info' });

app.use(express.logger(core.config.request_log_format));
app.use(express.compress());
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.cookieSession({
    secret: core.config.user_session_secret,
    cookie: {
        expires: new Date(Date.now() + core.config.user_session_timeout_seconds * 1000),
        maxAge: new Date(Date.now() + core.config.user_session_timeout_seconds * 1000),
    }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new BearerStrategy({}, core.services.accessTokens.verify));
passport.use(new PublicKeyStrategy({}, core.services.principals.verifySignature));

app.use(middleware.crossOrigin);

app.enable('trust proxy');
app.disable('x-powered-by');

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

core.services.initialize(function(err) {
    console.log('initialize finished: ' + err);
    if (err) return core.log.error("service failed to initialize: " + err);
    if (!core.services.principals.servicePrincipal) return core.log.error("Service principal not available after initialize.");

    server.listen(core.config.internal_port);

    core.log.info("registry service has initialized itself, exposing api externally at: " + core.config.api_endpoint + " and internally on: " + core.config.internal_port);

    // REST API ENDPOINTS

    // headwaiter endpoint
    app.get(core.config.headwaiter_path,                                               controllers.headwaiter.index);

    app.get(core.config.api_keys_path,              middleware.accessTokenAuth,        controllers.apiKeys.index);
    app.post(core.config.api_keys_path,             middleware.accessTokenAuth,        controllers.apiKeys.create);

    // ops endpoints
    app.get(core.config.ops_path + '/health',                                          controllers.ops.health);

    // principal endpoints
    app.post(core.config.principals_path + '/auth',                                    controllers.principals.legacyAuthentication);

    app.post(core.config.principals_path + '/publickey/auth', middleware.publicKeyAuth, controllers.principals.authenticate);
    app.post(core.config.principals_path + '/secret/auth', middleware.secretAuth,      controllers.principals.authenticate);

    app.get(core.config.principals_path + '/:id',   middleware.accessTokenAuth,        controllers.principals.show);
    app.get(core.config.principals_path,            middleware.accessTokenAuth,        controllers.principals.index);

    // TODO: CLI needs auth user and create user endpoints for now.
    app.post(core.config.principals_path + '/user/auth',                               controllers.principals.authenticateUser);
    app.post(core.config.principals_path,                                              controllers.principals.create);

    app.post(core.config.principals_path + '/accesstoken', middleware.accessTokenAuth, controllers.principals.accessTokenFor);
    app.post(core.config.principals_path + '/impersonate', middleware.accessTokenAuth, controllers.principals.impersonate);
    app.put(core.config.principals_path + '/:id',   middleware.accessTokenAuth,        controllers.principals.update);
    app.delete(core.config.principals_path + '/:id', middleware.accessTokenAuth,       controllers.principals.remove);

    // USER AND OAUTH2 ENDPOINTS

    // create user
    app.get(core.config.user_create_path,                                              controllers.users.createForm);
    app.post(core.config.user_create_path,                                             controllers.users.create);

    // login user
    app.get(core.config.user_login_path,                                               controllers.users.loginForm);
    app.post(core.config.user_login_path,                                              controllers.users.login);

    // change password
    app.get(core.config.user_change_password_path,  ensureLoggedIn,                    controllers.users.changePasswordForm);
    app.post(core.config.user_change_password_path, ensureLoggedIn,                    controllers.users.changePassword);

    // delete account
    app.get(core.config.user_delete_account_path,  ensureLoggedIn,                     controllers.users.deleteAccountForm);
    app.post(core.config.user_delete_account_path, ensureLoggedIn,                     controllers.users.deleteAccount);

    // reset password
    app.get(core.config.user_reset_password_path,                                      controllers.users.resetPasswordForm);
    app.post(core.config.user_reset_password_path,                                     controllers.users.resetPassword);

    // logout
    app.get(core.config.user_logout_path,           ensureLoggedIn,                    controllers.users.logout);

    // privacy policy and terms of service
    app.get(core.config.users_path + "/privacy",                                       controllers.users.privacy);
    app.get(core.config.users_path + "/terms",                                         controllers.users.terms);

    // user serialization and deserialization
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
        core.services.principals.findByIdCached(core.services.principals.servicePrincipal, id, done);
    });

    // oauth2 endpoints
    app.get(core.config.users_path + '/impersonate', ensureLoggedIn,                   controllers.users.impersonate);
    app.get(core.config.users_path + '/authorize', ensureLoggedIn,                     controllers.users.authorize);
    app.post(core.config.users_path + '/decision', ensureLoggedIn,                     controllers.users.decision);

    // static files (static/ is mapped to the root API url for any path not already covered above)
    app.use(express.static(path.join(__dirname, '/static')));

    core.log.info("registry service has initialized API endpoints");
});