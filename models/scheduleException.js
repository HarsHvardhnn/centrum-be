const mongoose = require("mongoose");

const scheduleExceptionSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ["vacation", "holiday", "sick_leave", "conference", "training", "personal", "other", "leave","break","meeting","coffee_break","lunch_break","dinner_break","other_break"],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  isFullDay: {
    type: Boolean,
    default: true
  },
  timeRanges: [{
    startTime: {
      type: String,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Start time must be in HH:MM format'
      }
    },
    endTime: {
      type: String,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'End time must be in HH:MM format'
      }
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});

// Compound index to ensure unique doctor-date combinations for exceptions
scheduleExceptionSchema.index({ doctorId: 1, date: 1 }, { unique: true });

// Pre-save middleware to validate time ranges
scheduleExceptionSchema.pre('save', function(next) {
  if (!this.isFullDay && this.timeRanges && this.timeRanges.length > 0) {
    for (let range of this.timeRanges) {
      const startMinutes = this.timeToMinutes(range.startTime);
      const endMinutes = this.timeToMinutes(range.endTime);
      
      if (startMinutes >= endMinutes) {
        return next(new Error('Start time must be before end time'));
      }
    }
  }
  next();
});

// Helper method to convert time string to minutes
scheduleExceptionSchema.methods.timeToMinutes = function(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper method to check if a time falls within any exception time range
scheduleExceptionSchema.methods.isTimeBlocked = function(timeStr) {
  if (this.isFullDay) return true;
  
  if (!this.timeRanges || this.timeRanges.length === 0) return false;
  
  const timeMinutes = this.timeToMinutes(timeStr);
  
  return this.timeRanges.some(range => {
    const startMinutes = this.timeToMinutes(range.startTime);
    const endMinutes = this.timeToMinutes(range.endTime);
    
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  });
};

module.exports = mongoose.model("ScheduleException", scheduleExceptionSchema); 