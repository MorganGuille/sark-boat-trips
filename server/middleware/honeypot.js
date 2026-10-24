// The booking forms contain a hidden field that real visitors never see or fill in. Bots tend to
// fill in every field they find, so a request with it filled in is dropped silently: `respond`
// sends a reply that looks normal, and nothing is saved or emailed.
const FIELD = "website_url";

const honeypot = (respond) => (req, res, next) => {
  if (req.body && req.body[FIELD]) {
    console.log("Honeypot field filled in, dropping request from", req.ip);
    return respond(res);
  }
  next();
};

module.exports = honeypot;
