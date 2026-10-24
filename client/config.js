// Address of the API server. Empty means "the same site that served this page", which is what
// production uses (the Express server serves both). `npm run dev` reads client/.env.development,
// which points at the local server. Nothing here ever needs editing by hand.
const URL = import.meta.env.VITE_API_URL ?? ''

export { URL };
