// Run once before the tests (npm test does it for you). The tests use a throwaway MongoDB that
// runs on your own computer; the program for it is downloaded the first time, and if every test
// file tried to download it at the same moment they would trip over each other.
const { MongoMemoryServer } = require('mongodb-memory-server');

MongoMemoryServer.create()
    .then((server) => server.stop())
    .then(() => console.log('Test database is ready.'))
    .catch((error) => {
        console.error('Could not start the test database:', error.message);
        process.exit(1);
    });
