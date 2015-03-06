var core = require('nitrogen-core');

var sendAuthResponse = function(res, principal, accessToken) {
    res.set('X-n2-set-access-token', JSON.stringify(accessToken));
    res.send({ principal: principal, accessToken: accessToken });
};

exports.legacyAuthentication = function(req, res) {
    core.services.principals.legacyAuthentication(req.body, function(err, principal, accessToken) {
        if (err) return core.utils.handleError(res, err);

        // since the authenticateRequest middleware was not run on this request run it manually.
        core.services.principals.updateLastConnection(principal, core.utils.ipFromRequest(req));

        sendAuthResponse(res, principal, accessToken);
    });
};

exports.accessTokenFor = function(req, res) {
    var options = req.body;
    var principalId = options.principal_id;

    core.services.principals.accessTokenFor(req.user, principalId, options, function(err, accessToken) {
        if (err) return core.utils.handleError(res, err);

        res.send({ accessToken: accessToken });
    });
};

exports.authenticateUser = function(req, res) {
    var email = req.body.email;
    var password = req.body.password;

    if (!email || !password) return core.utils.handleError(res, core.utils.badRequestError("You must provide both an email and password to authenticate."));

    core.services.principals.authenticateUser(email, password, function(err, principal) {
        if (err) return core.utils.handleError(res, core.utils.authenticationError('Your email or password were not accepted.'));

        req.user = principal;

        return exports.authenticate(req, res);
    });
};

// By the time we get here, authentication has been done by middleware.
exports.authenticate = function(req, res) {
    core.services.accessTokens.findOrCreateToken(req.user, function(err, accessToken) {
        if (err) return callback(err);

        // opportunistically update the last connection details for this principal.
        if (req.user && req.ips) {
            core.services.principals.updateLastConnection(req.user, core.utils.ipFromRequest(req));
        }

        core.log.debug("authenticated principal: " + req.user.id);
        sendAuthResponse(res, req.user, accessToken);
    });
};

exports.create = function(req, res) {
    delete req.body.created_at;

    // translate api_key (if any) from a hash value to an actual row.
    core.services.apiKeys.findByKey(req.body.api_key, function(err, apiKey) {
        if (err) return core.utils.handleError(res, err);

        req.body.api_key = apiKey;

        var principal = new core.models.Principal(req.body);

        core.services.principals.create(principal, function(err, principal) {
            if (err) return core.utils.handleError(res, err);

            core.services.accessTokens.create(principal, function(err, accessToken) {
                if (err) return core.utils.handleError(res, err);

                var principalJSON = principal.toJSON();

                // since the authenticateRequest middleware was not run on this request run it manually.
                core.services.principals.updateLastConnection(principal, core.utils.ipFromRequest(req));

                sendAuthResponse(res, principalJSON, accessToken);
            });
        });
    });
};

exports.impersonate = function(req, res) {
    core.services.principals.impersonate(req.user, req.body.id, function (err, impersonatedPrincipal, accessToken) {
        if (err) return core.utils.handleError(res, err);

        // don't use sendAuthResponse above or it will wipe out the request session for the impersonated one.
        res.send({ principal: impersonatedPrincipal, accessToken: accessToken });
    });
};

exports.index = function(req, res) {
    var query = core.utils.parseQuery(req);
    if (typeof query !== 'object')
        return core.utils.handleError(res, core.utils.badRequestError('Invalid query format.'));

    var options = core.utils.parseOptions(req);
    if (typeof options !== 'object')
        return core.utils.handleError(res, core.utils.badRequestError('Invalid options format.'));

    if (!options.sort) options.sort = { last_connection: -1 };

    core.services.principals.find(req.user, query, options, function (err, principals) {
        if (err) return core.utils.handleError(res, err);

		res.send({ principals: principals });
	});
};

exports.remove = function(req, res) {
    core.services.principals.removeById(req.user, req.params.id, function(err) {
        if (err) return core.utils.handleError(res, err);

        res.send(200);
    });
};

exports.show = function(req, res) {
	core.services.principals.findByIdCached(req.user, req.params.id, function (err, principal) {
		if (err) return core.utils.handleError(res, err);
		if (!principal) return core.utils.sendFailedResponse(res, 403, "Can't show requested principal.");

		res.send({ principal: principal });
	});
};

exports.update = function(req, res) {
    if (req.body.visible_to) return core.utils.handleError(res, core.utils.badRequest("update of principal can't include visible_to"));

    core.services.principals.update(req.user, req.params.id, req.body, function(err, principal) {
        if (err) return core.utils.handleError(res, err);

        res.send({ principal: principal });
    });
};
