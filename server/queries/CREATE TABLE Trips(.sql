CREATE TABLE Trips(
    trip_id SERIAL PRIMARY KEY,
    trip_date DATE NOT NULL,
    timeslot TIME NOT NULL,
    max_capacity SMALLINT NOT NULL CHECK (max_capacity >= 0),
    is_charter BOOLEAN DEFAULT FALSE,
    UNIQUE (trip_date, timeslot)
);

CREATE TABLE Customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    accommodation VARCHAR(255)
);

CREATE TABLE Bookings (
    booking_id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES Trips(trip_id) ON DELETE RESTRICT,
    customer_id INTEGER NOT NULL REFERENCES Customers(customer_id) ON DELETE RESTRICT,
    adults_booked SMALLINT NOT NULL CHECK (adults_booked >= 1),
    children_booked SMALLINT DEFAULT 0 CHECK (children_booked >= 0),
    message TEXT,
    booked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_booking_trip_id ON Bookings(trip_id);
