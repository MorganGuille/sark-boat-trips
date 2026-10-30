// Runs a job now and then every `everyMs`, never two at once (a slow run makes the next one wait).
// Used by index.js for the card charges and the reminder emails; the tests call the jobs directly.
const repeat = (name, job, everyMs = 60000) => {
    let running = false;
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            await job();
        } catch (error) {
            console.error(`${name} check failed:`, error.message);
        } finally {
            running = false;
        }
    };
    tick();
    return setInterval(tick, everyMs);
};

module.exports = { repeat };
