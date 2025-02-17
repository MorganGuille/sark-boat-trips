const Bookings = require("../models/bookings");


const checklogin = async (req, res) => {
    console.log("accessed")
    let { userName, password } = req.body
    console.log(req.body)
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




module.exports = { checklogin }