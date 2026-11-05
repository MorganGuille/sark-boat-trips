// Asks Vimeo's player how far in it is and whether it is paused. Its answers are what the row and the
// lightbox pass between them, so the video carries on from the same moment at either size. Answers null if
// there is no player yet, or it doesn't answer quickly: nobody should wait on a closing lightbox for it.
const ANSWER_WITHIN_MS = 500;

export const readVideo = (player) => {
    if (!player) return Promise.resolve(null);
    const answer = Promise.all([player.getCurrentTime(), player.getPaused()])
        .then(([seconds, paused]) => ({ seconds, paused }))
        .catch(() => null);
    const tooLong = new Promise((resolve) => { setTimeout(() => resolve(null), ANSWER_WITHIN_MS); });
    return Promise.race([answer, tooLong]);
};
