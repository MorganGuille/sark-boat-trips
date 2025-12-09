const nodemailer = require("nodemailer");
const { getClient, query } = require("../data-access/postgresql");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.gmail_address,
    pass: process.env.gmail_password,
  },
});
const sendEmail = async (mailOptions) => {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    console.warn("Booking was successful, but email notification failed.");
    return null;
  }
};







const addBookingPG = async (req, res) => {
  const getClient = req.app.get("db_postgres_client");
};
let client;

let {
  date,
  firstName,
  lastName,
  phone,
  adults,
  children = 0,
  email,
  timeslot,
  message,
  accommodation,
} = req.body;

adults = Number(adults);
children = Number(children);

const totalSeatsRequested = adults + children;
const childResponse = children > 0 ? `and ${children} children` : "";

if (!date || !email || !firstName || !phone || adults < 0 || !timeslot) {
  return res.status(400).send({
    ok: false,
    data: "Missing required booking details",
  });
}

try {
  client = await getClient();
  await client.query("Begin");

  let tripId;
  let maxCapacity;
} catch {}
