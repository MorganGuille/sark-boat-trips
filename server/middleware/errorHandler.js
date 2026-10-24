// Last middleware in the chain: any error passed to next(err) ends up here.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(`Error on ${req.method} ${req.originalUrl}:`, err);

  // Too late to send a JSON response, let Express close the connection
  if (res.headersSent) return next(err);

  // 4xx errors from Express itself (e.g. malformed JSON body) are the client's fault
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).send({
    ok: false,
    data: status === 500 ? "Something went wrong. Please try again later." : "Invalid request.",
  });
};

module.exports = errorHandler;
