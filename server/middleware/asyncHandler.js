// Express 4 doesn't catch errors from async route handlers, so an uncaught one
// becomes an unhandled rejection. This passes it to the error handler instead.
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

module.exports = asyncHandler;
