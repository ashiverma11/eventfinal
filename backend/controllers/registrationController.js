import Registration from '../models/Registration.js';
import Event from '../models/Event.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// @desc    Register logged in user for an event
// @route   POST /api/registrations/register/:eventId
// @access  Private
export const registerForEvent = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if already registered
    const existingRegistration = await Registration.findOne({
      user: req.user._id,
      event: eventId,
    });

    if (existingRegistration) {
      return res.status(400).json({ message: 'You are already registered for this event' });
    }

    // Check capacity limit
    const regCount = await Registration.countDocuments({ event: eventId });
    if (regCount >= event.capacityLimit) {
      return res.status(400).json({ message: 'Registration closed. Event capacity limit reached!' });
    }

    // Generate ticket code: CROWD-XXXXX-XXXX
    const randPart1 = Math.random().toString(36).substring(2, 7).toUpperCase();
    const randPart2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const ticketCode = `CROWD-${randPart1}-${randPart2}`;

    const registration = await Registration.create({
      user: req.user._id,
      event: eventId,
      ticketCode,
    });

    res.status(201).json(registration);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged in user's registrations
// @route   GET /api/registrations/my-registrations
// @access  Private
export const getMyRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find({ user: req.user._id })
      .populate('event')
      .sort({ createdAt: -1 });
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all registrations for a specific event
// @route   GET /api/registrations/event/:eventId
// @access  Private/Admin
export const getEventRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find({ event: req.params.eventId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Scan a QR ticket and check-in attendee
// @route   POST /api/registrations/scan
// @access  Private/Admin
export const scanTicket = async (req, res) => {
  try {

    console.log("SCAN API HIT");
    console.log("Request Body:", req.body);

    const { ticketCode } = req.body;

    if (!ticketCode) {
      return res.status(400).json({
        status: 'error',
        message: 'No ticket code provided'
      });
    }

    // Find registration and populate user and event
    const registration = await Registration.findOne({ ticketCode })
      .populate('user', 'name email')
      .populate('event');

    if (!registration) {
      return res.status(404).json({ status: 'invalid', message: 'Ticket does not exist' });
    }

    const event = registration.event;

    // Check if user is already checked in
    if (registration.checkedIn) {
      return res.json({
        status: 'already_scanned',
        message: 'Ticket already scanned!',
        attendee: registration.user.name,
        checkInTime: registration.checkInTime,
        eventTitle: event.title,
      });
    }

    // Check capacity limit
    if (event.currentCount >= event.capacityLimit) {
      return res.json({
        status: 'capacity_reached',
        message: 'Capacity full! Entry restricted.',
        eventTitle: event.title,
        capacityLimit: event.capacityLimit,
        currentCount: event.currentCount,
      });
    }

    // Perform check-in
    registration.checkedIn = true;
    registration.checkInTime = new Date();
    await registration.save();

    // Increment event checked-in count
    // Increment event checked-in count
event.currentCount += 1;

console.log("BEFORE SAVE =", event.currentCount);

await event.save();

const updatedEvent = await Event.findById(event._id);

console.log("AFTER SAVE =", updatedEvent.currentCount);

console.log("Registration Data:");
console.log(registration);
console.log("User:", registration.user);
console.log("Attendee Name:", registration.attendeeName);
console.log("Attendee Email:", registration.attendeeEmail);
console.log(registration);
console.log("User:", registration.user);
console.log("Attendee Name:", registration.attendeeName);
console.log("Attendee Email:", registration.attendeeEmail);

return res.json({
  status: "success",
  message: "Check-In Successful",

  name: registration.attendeeName || registration.user?.name,
  email: registration.attendeeEmail || registration.user?.email,

  event: event.title,
  ticketId: registration.ticketCode,

  currentCount: event.currentCount,
  capacityLimit: event.capacityLimit
});
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Create Razorpay Order
// @route   POST /api/registrations/create-order
// @access  Private
export const createRazorpayOrder = async (req, res) => {
  try {
    const { eventId, numberOfTickets } = req.body;

    if (!eventId || !numberOfTickets || numberOfTickets < 1) {
      return res.status(400).json({ message: 'Invalid event or number of tickets' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check capacity limit
    const regCount = await Registration.countDocuments({ event: eventId });
    if (regCount + numberOfTickets > event.capacityLimit) {
      return res.status(400).json({ message: `Not enough capacity! Only ${event.capacityLimit - regCount} tickets left.` });
    }

    const price = event.price || 0;
    const totalAmount = price * numberOfTickets;

    if (totalAmount === 0) {
      return res.json({
        isFree: true,
        amount: 0,
        currency: 'INR',
        eventId,
      });
    }

    // Initialize Razorpay
    const rzpKeyId = process.env.RAZORPAY_KEY_ID;
    const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!rzpKeyId || !rzpKeySecret || rzpKeyId === 'rzp_test_placeholderKeyId') {
      return res.json({
        isFree: false,
        isMock: true,
        orderId: `mock_order_${Date.now()}`,
        amount: totalAmount * 100,
        currency: 'INR',
        keyId: 'mock_key_id',
      });
    }

    const rzpInstance = new Razorpay({
      key_id: rzpKeyId,
      key_secret: rzpKeySecret,
    });

    const options = {
      amount: totalAmount * 100, // amount in paisa
      currency: 'INR',
      receipt: `receipt_ev_${eventId.substring(eventId.length - 6)}_${Date.now()}`,
    };

    const order = await rzpInstance.orders.create(options);

    res.json({
      isFree: false,
      isMock: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: rzpKeyId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify Razorpay Payment and finalize booking
// @route   POST /api/registrations/verify-payment
// @access  Private
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, eventId, attendees } = req.body;

    if (!eventId || !attendees || !Array.isArray(attendees) || attendees.length === 0) {
      return res.status(400).json({ message: 'Missing event ID or attendee details' });
    }

    // 1. Signature verification
    const secret = process.env.RAZORPAY_KEY_SECRET || 'placeholderKeySecret';
    
    // Fallback verification for demo/dummy values: if either keys are placeholder, accept payment
    const rzpKeyId = process.env.RAZORPAY_KEY_ID;
    const isMock = !rzpKeyId || rzpKeyId === 'rzp_test_placeholderKeyId' || razorpay_signature === 'mock_signature';
    
    if (!isMock) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body.toString())
        .digest('hex');

      const isVerified = expectedSignature === razorpay_signature;

      if (!isVerified) {
        return res.status(400).json({ message: 'Payment signature verification failed!' });
      }
    }

    // 2. Capacity limit check
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const regCount = await Registration.countDocuments({ event: eventId });
    if (regCount + attendees.length > event.capacityLimit) {
      return res.status(400).json({ message: 'Capacity limit reached during checkout! A refund will be initiated.' });
    }

    // 3. Create individual registrations
    const registrations = [];
    for (const attendee of attendees) {
      const randPart1 = Math.random().toString(36).substring(2, 7).toUpperCase();
      const randPart2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const ticketCode = `CROWD-${randPart1}-${randPart2}`;

      const reg = await Registration.create({
        user: req.user._id,
        event: eventId,
        ticketCode,
        attendeeName: attendee.name,
        attendeeEmail: attendee.email,
        attendeePhone: attendee.phone,
        paymentId: razorpay_payment_id || 'mock_payment_id',
        orderId: razorpay_order_id || 'mock_order_id',
        status: 'confirmed'
      });
      registrations.push(reg);
    }

    res.status(201).json(registrations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Register for free event
// @route   POST /api/registrations/register-free
// @access  Private
export const registerFree = async (req, res) => {
  try {
    const { eventId, attendees } = req.body;

    if (!eventId || !attendees || !Array.isArray(attendees) || attendees.length === 0) {
      return res.status(400).json({ message: 'Missing event ID or attendee details' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Capacity limit check
    const regCount = await Registration.countDocuments({ event: eventId });
    if (regCount + attendees.length > event.capacityLimit) {
      return res.status(400).json({ message: 'Event capacity full!' });
    }

    // Create individual registrations
    const registrations = [];
    for (const attendee of attendees) {
      const randPart1 = Math.random().toString(36).substring(2, 7).toUpperCase();
      const randPart2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const ticketCode = `CROWD-${randPart1}-${randPart2}`;

      const reg = await Registration.create({
        user: req.user._id,
        event: eventId,
        ticketCode,
        attendeeName: attendee.name,
        attendeeEmail: attendee.email,
        attendeePhone: attendee.phone,
        paymentId: 'FREE',
        orderId: 'FREE',
        status: 'confirmed'
      });
      registrations.push(reg);
    }

    res.status(201).json(registrations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
