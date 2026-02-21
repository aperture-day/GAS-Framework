/**
 * Default: Registers default GET and POST handlers for the AppBootstrap framework.
 */

/**
 * Default Route Not Found handler.
 */
function RouteNotFound(req) {
  return Response.json({
    status: false,
    message: 'Action not found',
    request: req,
  });
}
/**
 * Default GET handler.
 */
AppBootstrap.registerDefaultGet(RouteNotFound);

/**
 * Default POST handler.
 */
AppBootstrap.registerDefaultPost(RouteNotFound);
