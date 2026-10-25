// Works out which database the server connects to, from the environment (pass process.env).
// Used by the server and by the one-off scripts, so they can never disagree.
//
// Each environment has its own database user, restricted to its own database:
//   atlasDB_user / atlasDB_user_password   (the laptop uses a sandbox-only user)
// Until production has its own user it still uses the original atlasDB_password with the original
// user name, so nothing changes on Heroku until you set the new values there.
const ATLAS_HOST = 'bookingsdb.7bty4.mongodb.net';
const ORIGINAL_USER = 'morganguille';

const readDatabase = (env) => {
    const name = env.atlasDB_name;
    const isProduction = env.NODE_ENV === 'production';
    const user = env.atlasDB_user || ORIGINAL_USER;
    const password = env.atlasDB_user_password || env.atlasDB_password;

    // MONGODB_URI is a deliberate override (another host, or a throwaway database in the tests)
    if (env.MONGODB_URI) return { uri: env.MONGODB_URI, name: name || null, user: null, problem: null };

    // Outside production only a database with "sandbox" in its name is allowed, so a wrong .env
    // can never point a laptop at the real bookings
    const problem = !isProduction && !/sandbox/i.test(name || '')
        ? `refusing to connect to "${name || '(no name set)'}" outside production: only a database with "sandbox" in its name is allowed here. Check atlasDB_name in .env.`
        : null;

    return {
        uri: `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(password || '')}@${ATLAS_HOST}/${name}?retryWrites=true&w=majority&appName=BookingsDB`,
        name,
        user,
        problem,
    };
};

module.exports = { readDatabase };
