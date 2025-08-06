const mongoose = require("mongoose");

const timeBlockSchema = new mongoose.Schema({
  startTime: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Start time must be in HH:MM format'
    }
  },
  endTime: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'End time must be in HH:MM format'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const doctorScheduleSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  timeBlocks: [timeBlockSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});

// Compound index to ensure unique doctor-date combinations
doctorScheduleSchema.index({ doctorId: 1, date: 1 }, { unique: true });

// Pre-save middleware to validate time blocks
doctorScheduleSchema.pre('save', function(next) {
  if (this.timeBlocks && this.timeBlocks.length > 0) {
    for (let block of this.timeBlocks) {
      const startMinutes = this.timeToMinutes(block.startTime);
      const endMinutes = this.timeToMinutes(block.endTime);
      
      if (startMinutes >= endMinutes) {
        return next(new Error('Start time must be before end time'));
      }
    }
  }
  next();
});

// Helper method to convert time string to minutes
doctorScheduleSchema.methods.timeToMinutes = function(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper method to check if a time falls within any time block
doctorScheduleSchema.methods.isTimeAvailable = function(timeStr) {
  if (!this.timeBlocks || this.timeBlocks.length === 0) return false;
  
  const timeMinutes = this.timeToMinutes(timeStr);
  
  return this.timeBlocks.some(block => {
    if (!block.isActive) return false;
    
    const startMinutes = this.timeToMinutes(block.startTime);
    const endMinutes = this.timeToMinutes(block.endTime);
    
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  });
};

module.exports = mongoose.model("DoctorSchedule", doctorScheduleSchema); 