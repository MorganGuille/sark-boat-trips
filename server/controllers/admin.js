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
    // Only real text counts: String(["owner"]) would otherwise pass as "owner"
    const isText = typeof userName === "string" && typeof password === "string";
    const userOk = safeEqual(isText ? userName : "", process.env.admin_username);
    const passOk = await bcrypt.compare(
      isText ? password : "",
      process.env.admin_password_hash,
    );

    if (isText && userOk && passOk) {
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

// Season dates are stored as UTC midnight and exchanged as plain YYYY-MM-DD
const parseDay = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
};

const formatDay = (date) => date.toISOString().slice(0, 10);

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
      seasonStartDate: formatDay(dates.seasonStartDate),
      seasonEndDate: formatDay(dates.seasonEndDate),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ ok: false, data: "Could not load season dates" });
  }
};

const setSeasonDates = async (req, res) => {
  const start = parseDay(req.body.seasonStartDate);
  const end = parseDay(req.body.seasonEndDate);

  if (!start || !end) {
    return res
      .status(400)
      .send({ ok: false, data: "Start and end dates must be valid dates" });
  }
  if (start > end) {
    return res
      .status(400)
      .send({ ok: false, data: "End date must be on or after the start date" });
  }

  try {
    const updatedDates = await admin.findOneAndUpdate(
      {},
      { seasonStartDate: start, seasonEndDate: end },
      { new: true, upsert: true }
    );
    res.send({
      ok: true,
      data: "Season dates saved",
      seasonStartDate: formatDay(updatedDates.seasonStartDate),
      seasonEndDate: formatDay(updatedDates.seasonEndDate),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ ok: false, data: "Could not save season dates" });
  }
};

module.exports = { checklogin, setSeasonDates, getSeasonDates };
