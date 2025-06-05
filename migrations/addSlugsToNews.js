const mongoose = require('mongoose');
const { generateSlug } = require('../utils/slugUtils');

// Import models
const NewsArticle = require('../models/news');

const addSlugsToNews = async () => {
  try {
    console.log('Starting news migration...');
    
    // Connect to database if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/centrum');
    }

    const allNews = await NewsArticle.find({});
    console.log(`Found ${allNews.length} news articles to process`);
    
    for (const news of allNews) {
      if (!news.slug) {
        let slug = generateSlug(news.title);
        
        // Ensure uniqueness
        let counter = 1;
        while (await NewsArticle.findOne({ slug, _id: { $ne: news._id } })) {
          slug = `${generateSlug(news.title)}-${counter}`;
          counter++;
        }
        
        await NewsArticle.updateOne(
          { _id: news._id },
          { $set: { slug } }
        );
        
        console.log(`Updated news: ${news.title} -> ${slug}`);
      } else {
        console.log(`News already has slug: ${news.title} -> ${news.slug}`);
      }
    }
    
    console.log('News migration completed successfully!');
  } catch (error) {
    console.error('News migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  addSlugsToNews()
    .then(() => {
      console.log('Migration finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addSlugsToNews; 