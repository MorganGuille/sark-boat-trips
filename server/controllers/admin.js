const Bookings = require("../models/bookings");


const checklogin = async (req, res) => {
    let { userName, password } = req.body
    try {
        if (userName === process.env.admin_username && password === process.env.admin_password) {
            res.send({ ok: true, data: true })
        } else {
            res.send({ ok: false, data: false })
        }
    }
    catch {
        res.send({ ok: false, data: `Error` })
    }
}


const deleteAll = async (req, res) => {
    try {
        const result = await Bookings.deleteMany({});
        res.status(200).json({ message: `${result.deletedCount} records deleted.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to clear records." });
    }
};




module.exports = { checklogin, deleteAll }

