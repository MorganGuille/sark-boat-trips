const admin = require("../models/admin");

const checklogin = async (req, res) => {
  let { userName, password } = req.body;
  try {
    if (
      userName === process.env.admin_username &&
      password === process.env.admin_password
    ) {
      res.send({ ok: true, data: true });
    } else {
      res.send({ ok: false, data: false });
    }
  } catch {
    res.send({ ok: false, data: `Error` });
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
