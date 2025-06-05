const mongoose = require('mongoose');
const addSlugsToNews = require('./addSlugsToNews');
const addSlugsToServices = require('./addSlugsToServices');

const runAllMigrations = async () => {
  try {
    console.log('🚀 Starting all slug migrations...');
    
    // Connect to database
    if (mongoose.connection.readyState === 0) {
      console.log('📡 Connecting to database...');
      await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://HarshVardhan:aYUX2Fe7JfIKX5zo@cluster0.5xxpzqs.mongodb.net/centrum-v3?retryWrites=true&w=majority&appName=Cluster0');
      console.log('✅ Database connected successfully');
    }

    // Run news migration
    console.log('\n📰 Running news migration...');
    await addSlugsToNews();
    
    // Run services migration
    console.log('\n🛠️ Running services migration...');
    await addSlugsToServices();
    
    console.log('\n🎉 All migrations completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ News articles now have SEO-friendly slugs');
    console.log('✅ Services now have SEO-friendly slugs');
    console.log('✅ New API endpoints available:');
    console.log('   - GET /news/slug/:slug');
    console.log('   - GET /services/slug/:slug');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
  }
};

// Run migration if called directly
if (require.main === module) {
  runAllMigrations()
    .then(() => {
      console.log('Migration process finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}

module.exports = runAllMigrations; 