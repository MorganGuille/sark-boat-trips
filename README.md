
<img width="50" height="50" alt="boat-trips-circleLogo" src="https://github.com/user-attachments/assets/5d46ff05-b790-4239-9983-166747d45b4c" />

## Welcome to the repository for Sark Boat Trips, a functioning website and booking system developed during the Barcelona Code School Bootcamp.

This project serves as the official website and operational booking engine for a small boat trip business. The primary goal was to create a low-cost, flexible, and robust booking solution that is easy to maintain and scale for a small business.

In the past I had used paid booking systems but they didnt suit my specific needs for my local area and conditions, so I built my own!

### Key Features
- User-Friendly Interface: Clear, intuitive design for browsing available boat trips and information.

- Flexible Booking System: Custom-built to handle various trip types, capacities, and schedules.

- Secure Backend: Utilizes Express.js for routing and MongoDB for flexible data storage.

- Full-Stack JavaScript: Built entirely using JavaScript for both the frontend and backend.

### This is a classic MERN stack implementation, using JavaScript across the board.

## Project Structure
The project is structured to clearly separate concerns:

`client` contains the frontend with seperate `views` `css` and `components` 

`server` contains the backend code seperated into : 

`/models: Contains the Mongoose schemas for MongoDB (availability.js, booking.js, notes.js).`

`/routes: Defines the Express API endpoints.`

`/controllers: contains the logic`

## Running the checks

`npm run check` runs every automatic check: lint, the server tests and the browser tests. The tests use a throwaway database on your own computer, fake email and a fake Stripe, so they never touch your real data, send real emails or take real payments. The first run downloads a test database program, and the browser tests need `npx playwright install chromium` once.

You can also run them one at a time: `npm run lint`, `npm test` (server tests, about 10 seconds) and `npm run test:e2e` (a real browser using the site, about 40 seconds). GitHub runs the same checks every time you push (see `.github/workflows/ci.yml`), so a change that breaks booking, login or the website shows a red cross before it is deployed.
