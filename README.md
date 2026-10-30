
<img width="50" height="50" alt="boat-trips-circleLogo" src="https://github.com/user-attachments/assets/5d46ff05-b790-4239-9983-166747d45b4c" />

## Welcome to the repository for Sark Boat Trips, a functioning website and booking system developed during the Barcelona Code School Bootcamp.

This project serves as the official website and operational booking engine for a small boat trip business. The primary goal was to create a low-cost, flexible, and robust booking solution that is easy to maintain and scale for a small business.

In the past I had used paid booking systems but they didnt suit my specific needs for my local area and conditions, so I built my own!

### Key Features
- User-Friendly Interface: Clear, intuitive design for browsing available boat trips and information.

- Flexible Booking System: Custom-built to handle various trip types, capacities, and schedules.

- Secure Backend: Utilizes Express.js for routing and MongoDB for flexible data storage.

- Full-Stack JavaScript: Built entirely using JavaScript for both the frontend and backend.

- Owner dashboard: a private, password-protected page to see and manage bookings (add, edit, cancel and restore), set seats per trip, keep day notes, set the season dates and ticket prices, and download a monthly passenger and income report as a CSV.

- Card payments without refunds: customers save a card on Stripe's secure page when they book online (trips and private charters), nothing is charged at booking, and the card is charged when the trip starts. A trip cancelled for weather is cancelled on the dashboard first, so there is nothing to refund. The booking is created by a Stripe webhook as well as the success page, so a customer who closes the tab still gets booked.

### This is a classic MERN stack implementation, using JavaScript across the board.

## Project Structure
The project is structured to clearly separate concerns:

`client` contains the frontend with seperate `views` `css` and `components` 

`server` contains the backend code seperated into : 

`/models: Contains the Mongoose schemas for MongoDB (admin.js holds the season dates and prices, availability.js, bookings.js, notes.js).`

`/routes: Defines the Express API endpoints.`

`/controllers: contains the logic`

## Running it on your own computer

You need Node 22.11.0 (`nvm use 22.11.0`), then `npm install` in the project folder and again in `client`. Copy `server/.env.example` to `server/.env` and fill it in (every setting is explained in that file). Use a sandbox database: outside production the server refuses any database whose name doesn't contain "sandbox", and it only uses a Stripe *test* key, so a laptop can't touch real bookings or take real payments.

Then open two terminals in the project folder:

- `npm run dev:server` starts the API on port 4040 and restarts itself when a server file changes.
- `npm run dev:client` starts the website on port 5173. Open `http://127.0.0.1:5173`.

Dates are stored as `YYYY-MM-DD` and shown day-month-year. Before you do anything risky, `npm run backup` saves a copy of the database to a `backups` folder (it holds customer details and is never committed), and `npm run restore -- ../backups/<folder>` puts missing bookings back into the sandbox.

## Running the checks

`npm run check` runs every automatic check: lint, the server tests and the browser tests. The tests use a throwaway database on your own computer, fake email and a fake Stripe, so they never touch your real data, send real emails or take real payments. The first run downloads a test database program, and the browser tests need `npx playwright install chromium webkit` once (on a fresh Linux machine WebKit also needs `sudo npx playwright install-deps webkit`).

You can also run them one at a time: `npm run lint`, `npm test` (server tests, about 15 seconds) and `npm run test:e2e` (a real browser using the site on Chrome, an Android phone and Safari's engine, about 1.5 minutes). GitHub runs the same checks every time you push (see `.github/workflows/ci.yml`), so a change that breaks booking, login or the website shows a red cross before it is deployed.
