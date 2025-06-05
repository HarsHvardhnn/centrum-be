const mongoose = require('mongoose');
const { generateSlug } = require('../utils/slugUtils');

// Import models
const Service = require('../models/services');

const addSlugsToServices = async () => {
  try {
    console.log('Starting services migration...');
    
    // Connect to database if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/centrum');
    }

    const allServices = await Service.find({});
    console.log(`Found ${allServices.length} services to process`);
    
    for (const service of allServices) {
      if (!service.slug) {
        let slug = generateSlug(service.title);
        
        // Ensure uniqueness
        let counter = 1;
        while (await Service.findOne({ slug, _id: { $ne: service._id } })) {
          slug = `${generateSlug(service.title)}-${counter}`;
          counter++;
        }
        
        await Service.updateOne(
          { _id: service._id },
          { $set: { slug } }
        );
        
        console.log(`Updated service: ${service.title} -> ${slug}`);
      } else {
        console.log(`Service already has slug: ${service.title} -> ${service.slug}`);
      }
    }
    
    console.log('Services migration completed successfully!');
  } catch (error) {
    console.error('Services migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  addSlugsToServices()
    .then(() => {
      console.log('Migration finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addSlugsToServices; 