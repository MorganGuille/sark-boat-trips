const admin = require("../models/admin");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { toPence, readPrices } = require("../utils/prices");

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
    // The settings document can exist with only prices in it
    if (!dates || !dates.seasonStartDate || !dates.seasonEndDate) {
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

const toPounds = (pence) => pence / 100;

// Public: the booking page shows the prices. prices is null until the owner has set them.
const getPrices = async (req, res) => {
    try {
        const prices = await readPrices();
        res.send({
            ok: true,
            prices: prices && { adult: toPounds(prices.adult), child: toPounds(prices.child), charter: toPounds(prices.charter) },
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ ok: false, data: "Could not load prices" });
    }
};

const setPrices = async (req, res) => {
    const adult = toPence(req.body.adultPrice);
    const child = toPence(req.body.childPrice);
    const charter = toPence(req.body.charterPrice);

    if ([adult, child, charter].includes(null)) {
        return res.status(400).send({ ok: false, data: "Each price must be an amount in pounds, like 40 or 12.50 (up to 10,000)" });
    }

    try {
        await admin.findOneAndUpdate(
            {},
            { $set: { adultPrice: adult, childPrice: child, charterPrice: charter } },
            { upsert: true }
        );
        res.send({ ok: true, data: "Prices saved", prices: { adult: toPounds(adult), child: toPounds(child), charter: toPounds(charter) } });
    } catch (error) {
        console.error(error);
        res.status(500).send({ ok: false, data: "Could not save prices" });
    }
};

module.exports = { checklogin, setSeasonDates, getSeasonDates, getPrices, setPrices };
