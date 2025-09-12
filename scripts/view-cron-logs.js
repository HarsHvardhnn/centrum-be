/**
 * Script to view and analyze cron job execution logs
 * Usage: node scripts/view-cron-logs.js [options]
 * Options:
 *   --job-name <name>     Filter by specific job name
 *   --status <status>     Filter by status (running, completed, failed, partial)
 *   --days <number>       Show logs from last N days (default: 7)
 *   --detailed            Show detailed individual results
 *   --failed-only         Show only failed executions
 *   --summary             Show summary statistics
 */

const mongoose = require('mongoose');
const CronJobLog = require('../models/cronJobLog');
require('dotenv').config();

// Parse command line arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    jobName: null,
    status: null,
    days: 7,
    detailed: false,
    failedOnly: false,
    summary: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--job-name':
        options.jobName = args[++i];
        break;
      case '--status':
        options.status = args[++i];
        break;
      case '--days':
        options.days = parseInt(args[++i]) || 7;
        break;
      case '--detailed':
        options.detailed = true;
        break;
      case '--failed-only':
        options.failedOnly = true;
        break;
      case '--summary':
        options.summary = true;
        break;
      case '--help':
        console.log(`
Usage: node scripts/view-cron-logs.js [options]

Options:
  --job-name <name>     Filter by specific job name
  --status <status>     Filter by status (running, completed, failed, partial)
  --days <number>       Show logs from last N days (default: 7)
  --detailed            Show detailed individual results
  --failed-only         Show only failed executions
  --summary             Show summary statistics
  --help                Show this help message

Examples:
  node scripts/view-cron-logs.js --summary
  node scripts/view-cron-logs.js --failed-only --days 30
  node scripts/view-cron-logs.js --job-name appointment_reminder --detailed
        `);
        process.exit(0);
        break;
    }
  }

  return options;
};

// Format duration in human readable format
const formatDuration = (ms) => {
  if (!ms) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

// Format date for display
const formatDate = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Warsaw'
  });
};

// Display individual results
const displayIndividualResults = (log) => {
  if (!log.individualResults || log.individualResults.length === 0) {
    console.log('    No individual results available');
    return;
  }

  console.log(`    Individual Results (${log.individualResults.length}):`);
  
  log.individualResults.forEach((result, index) => {
    console.log(`      ${index + 1}. ${result.status.toUpperCase()} - ${result.recordType}`);
    console.log(`         Record ID: ${result.recordId}`);
    console.log(`         Time: ${formatDate(result.timestamp)}`);
    
    if (result.errorMessage) {
      console.log(`         Error: ${result.errorMessage}`);
    }
    
    if (result.details) {
      if (result.details.patientName) {
        console.log(`         Patient: ${result.details.patientName}`);
      }
      if (result.details.doctorName) {
        console.log(`         Doctor: ${result.details.doctorName}`);
      }
      if (result.details.appointmentDate) {
        console.log(`         Date: ${result.details.appointmentDate} ${result.details.appointmentTime}`);
      }
      if (result.details.skipReason) {
        console.log(`         Skip Reason: ${result.details.skipReason}`);
      }
      if (result.details.duration) {
        console.log(`         Duration: ${result.details.duration}ms`);
      }
    }
    
    console.log('');
  });
};

// Display log entry
const displayLogEntry = (log, options) => {
  console.log(`\n=== Execution ID: ${log.executionId} ===`);
  console.log(`Job Name: ${log.jobName}`);
  console.log(`Status: ${log.status.toUpperCase()}`);
  console.log(`Start Time: ${formatDate(log.startTime)}`);
  console.log(`End Time: ${log.endTime ? formatDate(log.endTime) : 'N/A'}`);
  console.log(`Duration: ${formatDuration(log.getDuration())}`);
  console.log(`Triggered By: ${log.metadata.triggeredBy}`);
  console.log(`Environment: ${log.metadata.environment}`);
  
  console.log(`\nRecords:`);
  console.log(`  Total: ${log.totalRecords}`);
  console.log(`  Processed: ${log.processedRecords}`);
  console.log(`  Successful: ${log.successfulRecords}`);
  console.log(`  Failed: ${log.failedRecords}`);
  console.log(`  Skipped: ${log.skippedRecords}`);
  
  if (log.processedRecords > 0) {
    console.log(`  Success Rate: ${log.getSuccessRate().toFixed(2)}%`);
  }
  
  if (log.errorMessage) {
    console.log(`\nError Message: ${log.errorMessage}`);
  }
  
  if (options.detailed) {
    displayIndividualResults(log);
  }
  
  console.log('='.repeat(50));
};

// Display summary statistics
const displaySummary = (logs) => {
  console.log('\n=== SUMMARY STATISTICS ===');
  
  const totalExecutions = logs.length;
  const completedExecutions = logs.filter(log => log.status === 'completed').length;
  const failedExecutions = logs.filter(log => log.status === 'failed').length;
  const partialExecutions = logs.filter(log => log.status === 'partial').length;
  const runningExecutions = logs.filter(log => log.status === 'running').length;
  
  console.log(`Total Executions: ${totalExecutions}`);
  console.log(`Completed: ${completedExecutions} (${((completedExecutions / totalExecutions) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failedExecutions} (${((failedExecutions / totalExecutions) * 100).toFixed(1)}%)`);
  console.log(`Partial: ${partialExecutions} (${((partialExecutions / totalExecutions) * 100).toFixed(1)}%)`);
  console.log(`Running: ${runningExecutions} (${((runningExecutions / totalExecutions) * 100).toFixed(1)}%)`);
  
  // Calculate totals
  const totalRecords = logs.reduce((sum, log) => sum + log.totalRecords, 0);
  const totalProcessed = logs.reduce((sum, log) => sum + log.processedRecords, 0);
  const totalSuccessful = logs.reduce((sum, log) => sum + log.successfulRecords, 0);
  const totalFailed = logs.reduce((sum, log) => sum + log.failedRecords, 0);
  const totalSkipped = logs.reduce((sum, log) => sum + log.skippedRecords, 0);
  
  console.log(`\nRecords:`);
  console.log(`  Total Found: ${totalRecords}`);
  console.log(`  Total Processed: ${totalProcessed}`);
  console.log(`  Total Successful: ${totalSuccessful}`);
  console.log(`  Total Failed: ${totalFailed}`);
  console.log(`  Total Skipped: ${totalSkipped}`);
  
  if (totalProcessed > 0) {
    console.log(`  Overall Success Rate: ${((totalSuccessful / totalProcessed) * 100).toFixed(2)}%`);
  }
  
  // Average duration
  const completedLogs = logs.filter(log => log.status === 'completed' && log.endTime);
  if (completedLogs.length > 0) {
    const avgDuration = completedLogs.reduce((sum, log) => sum + log.getDuration(), 0) / completedLogs.length;
    console.log(`  Average Duration: ${formatDuration(avgDuration)}`);
  }
  
  console.log('='.repeat(30));
};

// Main function
const viewCronLogs = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/centrum-v3');
    console.log('Connected to database');
    
    const options = parseArgs();
    
    // Build query
    const query = {};
    
    if (options.jobName) {
      query.jobName = options.jobName;
    }
    
    if (options.status) {
      query.status = options.status;
    }
    
    if (options.failedOnly) {
      query.status = { $in: ['failed', 'partial'] };
    }
    
    // Date filter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - options.days);
    query.startTime = { $gte: startDate };
    
    console.log(`\nQuerying logs with filters:`, query);
    console.log(`Showing logs from last ${options.days} days\n`);
    
    // Fetch logs
    const logs = await CronJobLog.find(query)
      .sort({ startTime: -1 })
      .limit(100); // Limit to prevent overwhelming output
    
    if (logs.length === 0) {
      console.log('No logs found matching the criteria.');
      return;
    }
    
    console.log(`Found ${logs.length} log entries\n`);
    
    // Display logs
    if (options.summary) {
      displaySummary(logs);
    } else {
      logs.forEach(log => {
        displayLogEntry(log, options);
      });
    }
    
    // Show recent failures if not already showing failed-only
    if (!options.failedOnly && !options.summary) {
      const recentFailures = logs.filter(log => log.status === 'failed' || log.status === 'partial');
      if (recentFailures.length > 0) {
        console.log(`\n⚠️  Found ${recentFailures.length} recent failed/partial executions. Use --failed-only to see details.`);
      }
    }
    
  } catch (error) {
    console.error('Error viewing cron logs:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

// Run if called directly
if (require.main === module) {
  viewCronLogs();
}

module.exports = { viewCronLogs };
