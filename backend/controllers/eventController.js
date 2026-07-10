import Event from '../models/Event.js';
import Registration from '../models/Registration.js';

// @desc    Get all events (with optional search and category filters)
// @route   GET /api/events
// @access  Public
export const getEvents = async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const events = await Event.find(query).sort({ date: 1 });
    
    const eventsWithRegCount = await Promise.all(
      events.map(async (event) => {
        const registrationsCount = await Registration.countDocuments({ event: event._id });
        return {
          ...event.toObject(),
          registrationsCount,
        };
      })
    );
    
    res.json(eventsWithRegCount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single event by ID
// @route   GET /api/events/:id
// @access  Public
export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new event
// @route   POST /api/events
// @access  Private/Admin
export const createEvent = async (req, res) => {
  try {
    const { title, description, date, time, venue, capacityLimit, category, bannerUrl, price } = req.body;

    if (!title || !description || !date || !time || !venue || !capacityLimit) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const event = await Event.create({
      title,
      description,
      date,
      time,
      venue,
      capacityLimit: Number(capacityLimit),
      category: category || 'General',
      bannerUrl: bannerUrl || '',
      price: price !== undefined ? Number(price) : 0,
    });

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an event
// @route   PUT /api/events/:id
// @access  Private/Admin
export const updateEvent = async (req, res) => {
  try {
    const { title, description, date, time, venue, capacityLimit, category, bannerUrl, price } = req.body;

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    event.title = title || event.title;
    event.description = description || event.description;
    event.date = date || event.date;
    event.time = time || event.time;
    event.venue = venue || event.venue;
    event.capacityLimit = capacityLimit !== undefined ? Number(capacityLimit) : event.capacityLimit;
    event.category = category || event.category;
    event.bannerUrl = bannerUrl || event.bannerUrl;
    event.price = price !== undefined ? Number(price) : event.price;

    const updatedEvent = await event.save();
    res.json(updatedEvent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an event
// @route   DELETE /api/events/:id
// @access  Private/Admin
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    await event.deleteOne();
    res.json({ message: 'Event removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
