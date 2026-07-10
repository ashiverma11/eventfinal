import Registration from './models/Registration.js';
import Event from './models/Event.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

// Route Imports
import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

// Load environmental variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/analytics', analyticsRoutes);

// Base route
app.get('/', (req, res) => {
  res.send('Event Crowd API is running...');
});
app.get('/checkin/:ticketId', async (req, res) => {
  try {
    const ticketId = req.params.ticketId;

    const registration = await Registration.findOne({
      ticketCode: ticketId
    })
    .populate('event')
    .populate('user');

    if (!registration) {
      return res.send(`
        <h1>❌ Invalid Ticket</h1>
      `);
    }

    // First Time Check-In
    if (!registration.checkedIn) {

      registration.checkedIn = true;
      registration.checkInTime = new Date();
      await registration.save();

      registration.event.currentCount += 1;
      await registration.event.save();
    }

    return res.send(`
      <html>
      <body style="font-family:Arial;text-align:center;padding:40px;">
        <h1>✅ Check-In Successful</h1>

        <h3>Name: ${
          registration.attendeeName ||
          registration.user?.name ||
          "N/A"
        }</h3>

        <h3>Email: ${
          registration.attendeeEmail ||
          registration.user?.email ||
          "N/A"
        }</h3>

        <h3>Event: ${registration.event.title}</h3>

        <h3>Ticket ID: ${registration.ticketCode}</h3>

        <h2>Crowd Count: ${registration.event.currentCount}</h2>

      </body>
      </html>
    `);

  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// Error handling middleware (fallback)
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in development mode on port ${PORT}`);
});
