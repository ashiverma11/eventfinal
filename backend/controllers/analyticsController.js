import User from '../models/User.js';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';

// @desc    Get live crowd occupancy statistics for admin dashboards
// @route   GET /api/analytics/live-status
// @access  Private/Admin
export const getLiveStatus = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalEvents = await Event.countDocuments({});
    const totalRegistrations = await Registration.countDocuments({});
    const totalCheckIns = await Registration.countDocuments({ checkedIn: true });

    // Detailed metrics per event
    const events = await Event.find({});
    const eventStats = await Promise.all(
      events.map(async (event) => {
        const registrationsCount = await Registration.countDocuments({ event: event._id });
        return {
          ...event.toObject(),
          eventId: event._id,
          registrationsCount,
          occupancyRate: event.capacityLimit > 0
            ? Math.round((event.currentCount / event.capacityLimit) * 100)
            : 0,
        };
      })
    );

    res.json({
      summary: {
        totalUsers,
        totalEvents,
        totalRegistrations,
        totalCheckIns,
      },
      events: eventStats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get attendance report timeline data
// @route   GET /api/analytics/attendance-report
// @access  Private/Admin
export const getAttendanceReport = async (req, res) => {
  try {
    // Generate simple hourly check-in timeline (mocked or aggregated from db timestamps)
    const checkedInRegistrations = await Registration.find({ checkedIn: true })
      .select('checkInTime')
      .sort({ checkInTime: 1 });

    // Group check-ins by hour
    const hourlyDistribution = {};
    checkedInRegistrations.forEach((reg) => {
      if (reg.checkInTime) {
        const hour = new Date(reg.checkInTime).toLocaleTimeString([], { hour: '2-digit', hour12: true });
        hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
      }
    });

    // If empty, supply some default hours so chart doesn't look completely empty on first load
    if (Object.keys(hourlyDistribution).length === 0) {
      hourlyDistribution['09:00 AM'] = 0;
      hourlyDistribution['10:00 AM'] = 0;
      hourlyDistribution['11:00 AM'] = 0;
      hourlyDistribution['12:00 PM'] = 0;
    }

    res.json({
      hourlyCheckIns: {
        labels: Object.keys(hourlyDistribution),
        data: Object.values(hourlyDistribution),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
