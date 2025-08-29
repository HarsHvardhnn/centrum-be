const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const DUMP_DIR = path.join(__dirname, '..', 'dumps');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const DB_NAME = process.env.DB_NAME || 'centrum-v3'; // Default database name
// const DB_URI = "mongodb+srv://HarshVardhan:aYUX2Fe7JfIKX5zo@cluster0.5xxpzqs.mongodb.net/centrum-v3?retryWrites=true&w=majority&appName=Cluster0";
const RESTORE_URI = "mongodb+srv://centrummedyczne7skarzysko_db_user:g09thUYeVTNiki2S@centrum.0psoww9.mongodb.net/";


// Ensure dumps directory exists
if (!fs.existsSync(DUMP_DIR)) {
  fs.mkdirSync(DUMP_DIR, { recursive: true });
  console.log(`Created dumps directory: ${DUMP_DIR}`);
}

// Function to find MongoDB Tools path
function findMongoTools() {
  const possiblePaths = [
    'mongodump', // Try PATH first
    'C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongodump.exe',
    'C:\\Program Files\\MongoDB\\Tools\\6.0\\bin\\mongodump.exe',
    'C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\mongodump.exe',
    'C:\\Program Files\\MongoDB\\Server\\5.0\\bin\\mongodump.exe',
    'C:\\Program Files\\MongoDB\\Server\\4.4\\bin\\mongodump.exe',
    'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Programs\\MongoDB\\Tools\\100\\bin\\mongodump.exe',
    'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Programs\\MongoDB\\Tools\\6.0\\bin\\mongodump.exe'
  ];

  return new Promise((resolve) => {
    function tryPath(index) {
      if (index >= possiblePaths.length) {
        resolve(null);
        return;
      }

      const testPath = possiblePaths[index];
      exec(`"${testPath}" --version`, (error) => {
        if (error) {
          tryPath(index + 1);
        } else {
          resolve(testPath);
        }
      });
    }
    tryPath(0);
  });
}

// Function to create backup
async function createBackup() {
  const dumpPath = path.join(DUMP_DIR, `backup-${TIMESTAMP}`);
  
  // Find mongodump path
  const mongoDumpPath = await findMongoTools();
  if (!mongoDumpPath) {
    console.error('❌ mongodump not found in common locations');
    console.error('Please install MongoDB Database Tools or add to PATH:');
    console.error('Windows: https://docs.mongodb.com/database-tools/installation/');
    console.error('Linux: sudo apt-get install mongodb-database-tools');
    console.error('macOS: brew install mongodb-database-tools');
    console.error('');
    console.error('Common Windows installation paths:');
    console.error('- C:\\Program Files\\MongoDB\\Tools\\100\\bin\\');
    console.error('- C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\');
    console.error('- C:\\Users\\[Username]\\AppData\\Local\\Programs\\MongoDB\\Tools\\100\\bin\\');
    return;
  }

  console.log(`🔍 Found mongodump at: ${mongoDumpPath}`);

  console.log(`🚀 Starting MongoDB backup...`);
  console.log(`📁 Database: ${DB_NAME}`);
  console.log(`📂 Output: ${dumpPath}`);
  console.log(`🔗 Database URI: ${DB_URI ? 'Set' : 'Not set'}`);
  
  // Check if we can connect to the database
  if (!DB_URI) {
    console.log(`⚠️  No database connection string found. Using localhost:27017`);
  }
    
    // Build mongodump command
    let command;
    
    // For MongoDB Atlas (cloud), use --uri parameter
    if (DB_URI && (DB_URI.includes('mongodb+srv://') || DB_URI.includes('mongodb://'))) {
      command = `"${mongoDumpPath}" --uri "${DB_URI}" --db ${DB_NAME} --out "${dumpPath}"`;
      console.log(`🌐 Using MongoDB Atlas connection`);
    } else {
      // For local MongoDB, use traditional parameters
      command = `"${mongoDumpPath}" --db ${DB_NAME} --out "${dumpPath}"`;
      
      // Add authentication if credentials are provided
      if (DB_URI && DB_URI.includes('@')) {
        const uriMatch = DB_URI.match(/mongodb:\/\/([^:]+):([^@]+)@/);
        if (uriMatch) {
          const [, username, password] = uriMatch;
          command = `"${mongoDumpPath}" --db ${DB_NAME} --username "${username}" --password "${password}" --out "${dumpPath}"`;
        }
      }
    }
    
    console.log(`🔧 Command: ${command}`);
    
    // Execute backup
    console.log(`🔄 Executing command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      console.log(`📤 Command completed. Error: ${error ? 'Yes' : 'No'}`);
      
      if (error) {
        console.error('❌ Backup failed:', error.message);
        if (stderr) console.error('Error details:', stderr);
        if (stdout) console.error('Output:', stdout);
        
        // Create error summary
        const summaryPath = path.join(DUMP_DIR, `backup-summary-${TIMESTAMP}.txt`);
        const summary = `Backup Summary
================
Timestamp: ${new Date().toISOString()}
Database: ${DB_NAME}
Backup Path: ${dumpPath}
Status: FAILED
Error: ${error.message}
Command: ${command}
`;
        fs.writeFileSync(summaryPath, summary);
        console.log(`📝 Error summary created: ${summaryPath}`);
        return;
      }
      
      if (stdout) console.log('Backup output:', stdout);
      if (stderr) console.log('Backup stderr:', stderr);
      
      // Wait a moment for files to be written
      setTimeout(() => {
        // Check if backup directory exists and get file list
        let fileList = 'No files found';
        let status = 'Success';
        
        if (fs.existsSync(dumpPath)) {
          try {
            const files = fs.readdirSync(dumpPath);
            fileList = files.length > 0 ? files.join(', ') : 'No files found';
            console.log(`📁 Backup directory contents: ${fileList}`);
          } catch (error) {
            fileList = 'Error reading files: ' + error.message;
            status = 'Warning - Could not read files';
          }
        } else {
          status = 'Warning - Backup directory not found';
          console.log(`⚠️  Backup directory not found: ${dumpPath}`);
        }
        
        console.log(`✅ Backup completed with status: ${status}`);
        console.log(`📁 Backup location: ${dumpPath}`);
        
        // Create a summary file
        const summaryPath = path.join(DUMP_DIR, `backup-summary-${TIMESTAMP}.txt`);
        const summary = `Backup Summary
================
Timestamp: ${new Date().toISOString()}
Database: ${DB_NAME}
Backup Path: ${dumpPath}
Status: ${status}
Files: ${fileList}
Command: ${command}
`;
        
        fs.writeFileSync(summaryPath, summary);
        console.log(`📝 Summary created: ${summaryPath}`);
      }, 2000); // Wait 2 seconds for files to be written
    });
  }

// Function to list existing backups
function listBackups() {
  if (!fs.existsSync(DUMP_DIR)) {
    console.log('No dumps directory found.');
    return;
  }
  
  const backups = fs.readdirSync(DUMP_DIR)
    .filter(item => item.startsWith('backup-'))
    .sort()
    .reverse();
  
  if (backups.length === 0) {
    console.log('No backups found.');
    return;
  }
  
  console.log('📋 Existing backups:');
  backups.forEach((backup, index) => {
    const backupPath = path.join(DUMP_DIR, backup);
    const stats = fs.statSync(backupPath);
    const size = (stats.size / 1024 / 1024).toFixed(2); // MB
    console.log(`${index + 1}. ${backup} (${size} MB) - ${stats.mtime.toLocaleString()}`);
  });
}

// Function to restore from backup
async function restoreBackup(backupName) {
  if (!backupName) {
    console.error('❌ Please provide a backup name to restore from');
    console.error('Usage: node backup-database.js restore <backup-name>');
    return;
  }
  
  const backupPath = path.join(DUMP_DIR, backupName);
  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Backup not found: ${backupPath}`);
    return;
  }
  
  // Find mongorestore path
  const mongoRestorePath = await findMongoTools().then(path => path ? path.replace('mongodump.exe', 'mongorestore.exe') : null);
  if (!mongoRestorePath) {
    console.error('❌ mongorestore not found');
    return;
  }
  
  console.log(`🔄 Restoring from backup: ${backupName}`);
  console.log(`⚠️  This will overwrite the current database!`);
  
  // Build mongorestore command
  let command;
  
  // For MongoDB Atlas (cloud), use --uri parameter
  if (RESTORE_URI && (RESTORE_URI.includes('mongodb+srv://') || RESTORE_URI.includes('mongodb://'))) {
    command = `"${mongoRestorePath}" --uri "${RESTORE_URI}" --db ${DB_NAME} --drop "${path.join(backupPath, DB_NAME)}"`;
    console.log(`🌐 Using MongoDB Atlas connection for restore`);
  } else {
    // For local MongoDB, use traditional parameters
    command = `"${mongoRestorePath}" --db ${DB_NAME} --drop "${path.join(backupPath, DB_NAME)}"`;
    
    // Add authentication if credentials are provided
    if (DB_URI && DB_URI.includes('@')) {
      const uriMatch = DB_URI.match(/mongodb:\/\/([^:]+):([^@]+)@/);
      if (uriMatch) {
        const [, username, password] = uriMatch;
        command = `"${mongoRestorePath}" --db ${DB_NAME} --username "${username}" --password "${password}" --drop "${path.join(backupPath, DB_NAME)}"`;
      }
    }
  }
  
  console.log(`🔧 Command: ${command}`);
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Restore failed:', error.message);
      if (stderr) console.error('Error details:', stderr);
      return;
    }
    
    if (stdout) console.log('Restore output:', stdout);
    console.log('✅ Database restored successfully!');
  });
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'backup':
  case undefined:
    createBackup();
    break;
  case 'list':
    listBackups();
    break;
  case 'restore':
    const backupName = args[1];
    restoreBackup(backupName);
    break;
  default:
    console.log('📚 MongoDB Backup Script');
    console.log('========================');
    console.log('');
    console.log('Usage:');
    console.log('  node backup-database.js [command]');
    console.log('');
    console.log('Commands:');
    console.log('  backup    Create a new backup (default)');
    console.log('  list      List existing backups');
    console.log('  restore   Restore from a specific backup');
    console.log('');
    console.log('Examples:');
    console.log('  node backup-database.js');
    console.log('  node backup-database.js backup');
    console.log('  node backup-database.js list');
    console.log('  node backup-database.js restore backup-2024-01-15T10-30-00-000Z');
    console.log('');
    console.log('Environment Variables:');
    console.log('  DB_NAME: Database name (default: centrum)');
    console.log('  MONGODB_URI: MongoDB connection string');
    console.log('  DB_URI: Alternative MongoDB connection string');
}
