const mongoose = require('mongoose');

const cronJobLogSchema = new mongoose.Schema({
  jobName: {
    type: String,
    required: true,
    index: true
  },
  executionId: {
    type: String,
    required: true,
    unique: true
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['running', 'completed', 'failed', 'partial'],
    required: true,
    default: 'running',
    index: true
  },
  totalRecords: {
    type: Number,
    default: 0
  },
  processedRecords: {
    type: Number,
    default: 0
  },
  successfulRecords: {
    type: Number,
    default: 0
  },
  failedRecords: {
    type: Number,
    default: 0
  },
  skippedRecords: {
    type: Number,
    default: 0
  },
  errorMessage: {
    type: String,
    default: null
  },
  errorStack: {
    type: String,
    default: null
  },
  executionDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  individualResults: [{
    recordId: String,
    recordType: String,
    status: {
      type: String,
      enum: ['success', 'failed', 'skipped']
    },
    errorMessage: String,
    details: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    triggeredBy: {
      type: String,
      enum: ['cron', 'manual', 'test'],
      default: 'cron'
    },
    environment: {
      type: String,
      default: process.env.NODE_ENV || 'development'
    },
    version: {
      type: String,
      default: '1.0.0'
    }
  }
}, {
  timestamps: true
});

// Index for efficient querying
cronJobLogSchema.index({ jobName: 1, startTime: -1 });
cronJobLogSchema.index({ status: 1, startTime: -1 });
cronJobLogSchema.index({ startTime: -1 });

// Add method to calculate duration
cronJobLogSchema.methods.getDuration = function() {
  if (this.endTime && this.startTime) {
    return this.endTime.getTime() - this.startTime.getTime();
  }
  return null;
};

// Add method to get success rate
cronJobLogSchema.methods.getSuccessRate = function() {
  if (this.processedRecords > 0) {
    return (this.successfulRecords / this.processedRecords) * 100;
  }
  return 0;
};

// Add method to mark as completed
cronJobLogSchema.methods.markCompleted = function() {
  this.endTime = new Date();
  this.status = 'completed';
  return this.save();
};

// Add method to mark as failed
cronJobLogSchema.methods.markFailed = function(error) {
  this.endTime = new Date();
  this.status = 'failed';
  this.errorMessage = error.message;
  this.errorStack = error.stack;
  return this.save();
};

// Add method to add individual result
cronJobLogSchema.methods.addResult = function(result) {
  this.individualResults.push(result);
  this.processedRecords++;
  
  if (result.status === 'success') {
    this.successfulRecords++;
  } else if (result.status === 'failed') {
    this.failedRecords++;
  } else if (result.status === 'skipped') {
    this.skippedRecords++;
  }
  
  return this.save();
};

module.exports = mongoose.model('CronJobLog', cronJobLogSchema);
