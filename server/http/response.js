function sendError(res, error, statusCode = 400) {
  res.status(statusCode).json({
    ok: false,
    message: error && error.message ? error.message : String(error),
  });
}

module.exports = {
  sendError,
};
