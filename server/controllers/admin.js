const admin = require("../models/admin");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

// Hash both sides first so timingSafeEqual gets equal-length buffers
const safeEqual = (a, b) => {
  const hash = (v) => crypto.createHash("sha256").update(String(v)).digest();
  return crypto.timingSafeEqual(hash(a), hash(b));
};

const checklogin = async (req, res) => {
  const { userName, password } = req.body;
  try {
    // Always run both checks so a wrong username takes as long as a wrong password
    const userOk = safeEqual(userName ?? "", process.env.admin_username);
    const passOk = await bcrypt.compare(
      String(password ?? ""),
      process.env.admin_password_hash,
    );

    if (userOk && passOk) {
      const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, {
        expiresIn: "8h",
      });
      res.send({ ok: true, data: true, token });
    } else {
      res.status(401).send({ ok: false, data: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ ok: false, data: "Error" });
  }
};

const getSeasonDates = async (req, res) => {
  try {
    const dates = await admin.findOne();
    if (!dates) {
      return res.status(404).send({
        ok: false,
        data: "Season dates not set",
      });
    }
    return res.send({
      ok: true,
      seasonStartDate: dates.seasonStartDate,
      seasonEndDate: dates.seasonEndDate,
    });
  } catch (error) {
    console.error(error);
    res.send({ ok: false, data: "check console for errors" });
  }
};

const setSeasonDates = async (req, res) => {
  const { seasonStartDate, seasonEndDate } = req.body;
  try {
    const updatedDates = await admin.findOneAndUpdate(
      {},
      {
        seasonStartDate: new Date(seasonStartDate),
        seasonEndDate: new Date(seasonEndDate),
      },
      { new: true, upsert: true }
    );
    res.send({
      ok: true,
      data: `Season set! start date: ${updatedDates.seasonStartDate} and end date: ${updatedDates.seasonEndDate}`,
    });
  } catch (error) {
    res.send({ ok: false, data: "check console for errors" });
    console.log(error);
  }
};

module.exports = { checklogin, setSeasonDates, getSeasonDates };
