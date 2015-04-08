var core = require('nitrogen-core')
  , passport = require('passport');

var tokenNearExpirationCheck = function(req, res, callback) {
    var secondsToExpiration = req.user.jwtToken.exp - (Date.now() / 1000);

    if (secondsToExpiration > core.config.refresh_token_threshold * core.config.access_token_lifetime * 24 * 60 * 60)
        return callback();

    core.services.accessTokens.create(req.user, function(err, accessToken) {
        if (err) return callback(err);

        res.set('X-n2-set-access-token', JSON.stringify(accessToken));

        callback();
    });
};

module.exports = function(req, res, next) {
    var auth = passport.authenticate(['bearer'], { session: false });
    req.pause();

    auth(req, res, function(err, failed) {
        if (err) {
            req.resume();
            return core.utils.handleError(res, core.utils.authenticationError());
        }

        tokenNearExpirationCheck(req, res, function(err) {
            req.resume();

            if (err) return res.send(core.utils.authenticationError(err));

            // opportunistically update the last connection details for this principal.
            if (req.user && req.ips) {
                core.services.principals.updateLastConnection(req.user, core.utils.ipFromRequest(req));
            }

            next();
        });
    });
};