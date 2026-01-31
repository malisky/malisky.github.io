const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const heicConvert = require('heic-convert');

class ImageOptimizer {
  constructor() {
    this.imagesDir = './docs/images';
    this.optimizedDir = './docs/images-optimized';
    
    // Optimization settings
    this.settings = {
      featured: { width: 2560, height: 1920, quality: 95 },
      content: { width: 1920, height: 1440, quality: 92 },
      thumbnail: { width: 800, height: 600, quality: 88 }
    };
  }

  // Optimize a specific folder
  async optimizeFolder(folderName) {
    console.log(`🖼️  Starting optimization for folder: ${folderName}`);
    
    try {
      const sourceFolder = path.join(this.imagesDir, folderName);
      
      // Check if source folder exists
      if (!fs.existsSync(sourceFolder)) {
        console.error(`❌ Source folder not found: ${sourceFolder}`);
        return;
      }
      
      // Create optimized directory if it doesn't exist
      if (!fs.existsSync(this.optimizedDir)) {
        fs.mkdirSync(this.optimizedDir, { recursive: true });
      }
      
      // Create the target folder in optimized directory
      const targetFolder = path.join(this.optimizedDir, folderName);
      if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true });
      }
      
      // Process only the specified folder
      await this.processDirectory(sourceFolder);
      
      console.log(`✅ Optimization complete for folder: ${folderName}`);
      console.log(`📁 Optimized images saved to: ${targetFolder}`);
      
    } catch (error) {
      console.error('❌ Error during optimization:', error.message);
      throw error;
    }
  }

  // Optimize all folders by processing each one individually
  async optimizeAllFolders() {
    console.log('🖼️  Starting optimization for all folders...');
    
    try {
      const folders = this.getFoldersInImages();
      
      if (folders.length === 0) {
        console.log('📁 No folders found in images directory');
        return;
      }
      
      console.log(`📁 Found ${folders.length} folders: ${folders.join(', ')}`);
      
      for (const folder of folders) {
        await this.optimizeFolder(folder);
      }
      
      console.log('✅ All folders optimized!');
      
    } catch (error) {
      console.error('❌ Error during optimization:', error.message);
      throw error;
    }
  }

  // Get all folder names in the images directory
  getFoldersInImages() {
    if (!fs.existsSync(this.imagesDir)) {
      return [];
    }
    
    const items = fs.readdirSync(this.imagesDir);
    return items.filter(item => {
      const fullPath = path.join(this.imagesDir, item);
      return fs.statSync(fullPath).isDirectory();
    });
  }

  // Process a directory recursively
  async processDirectory(dirPath) {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = path.relative(this.imagesDir, fullPath);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        // Create corresponding directory in optimized folder
        const optimizedSubDir = path.join(this.optimizedDir, relativePath);
        if (!fs.existsSync(optimizedSubDir)) {
          fs.mkdirSync(optimizedSubDir, { recursive: true });
        }
        
        // Recursively process subdirectory
        await this.processDirectory(fullPath);
      } else if (this.isImageFile(item)) {
        await this.optimizeImage(fullPath, relativePath);
      }
    }
  }

  // Check if file is an image
  isImageFile(filename) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
    const ext = path.extname(filename).toLowerCase();
    return imageExtensions.includes(ext);
  }

  // Optimize a single image (JPEG, PNG, GIF, WebP, or HEIC → WebP)
  async optimizeImage(imagePath, relativePath) {
    try {
      const stats = fs.statSync(imagePath);
      const originalSize = stats.size;
      const ext = path.extname(imagePath).toLowerCase();

      console.log(`📸 Processing: ${relativePath} (${(originalSize/1024).toFixed(0)}KB)`);

      const settings = this.getOptimizationSettings(relativePath);

      let input = imagePath;
      if (ext === '.heic') {
        const heicBuffer = fs.readFileSync(imagePath);
        const jpegBuffer = await heicConvert({
          buffer: heicBuffer,
          format: 'JPEG'
        });
        input = jpegBuffer;
      }

      const webpBuffer = await sharp(input)
        .rotate()
        .resize(settings.width, settings.height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: settings.quality })
        .toBuffer();

      const optimizedPath = path.join(this.optimizedDir, relativePath);
      const webpPath = optimizedPath.replace(/\.(jpeg|jpg|png|gif|webp|heic)$/i, '.webp');
      fs.writeFileSync(webpPath, webpBuffer);

      const newSize = webpBuffer.length;
      const savings = ((originalSize - newSize) / originalSize * 100).toFixed(1);

      console.log(`✅ Optimized: ${relativePath} - ${(originalSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB (${savings}% smaller)`);

    } catch (error) {
      console.warn(`⚠️  Could not optimize ${relativePath}:`, error.message);
    }
  }

  // Determine optimization settings based on image location/name
  getOptimizationSettings(relativePath) {
    const pathLower = relativePath.toLowerCase();
    
    // Featured images (usually the first image in each newsletter)
    if (pathLower.includes('baden1') || pathLower.includes('georgia1') || 
        pathLower.includes('mongolia1') || pathLower.includes('hangzhou1') ||
        pathLower.includes('slovenia1') || pathLower.includes('taiwan1')) {
      return this.settings.featured;
    }
    
    // Thumbnails and small images
    if (pathLower.includes('icon') || pathLower.includes('thumb') || 
        pathLower.includes('small') || pathLower.includes('logo')) {
      return this.settings.thumbnail;
    }
    
    // Default to content images
    return this.settings.content;
  }

  // Update HTML files to use optimized images
  async updateHtmlFiles() {
    console.log('🔄 Updating HTML files to use optimized images...');
    
    try {
      const htmlFiles = this.findHtmlFiles('./docs');
      
      for (const htmlFile of htmlFiles) {
        await this.updateHtmlFile(htmlFile);
      }
      
      console.log('✅ HTML files updated!');
      
    } catch (error) {
      console.error('❌ Error updating HTML files:', error.message);
    }
  }

  // Find all HTML files recursively
  findHtmlFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        files.push(...this.findHtmlFiles(fullPath));
      } else if (item.endsWith('.html')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  // Update a single HTML file
  async updateHtmlFile(htmlPath) {
    try {
      let content = fs.readFileSync(htmlPath, 'utf8');
      let updated = false;
      
      // Replace image paths to use optimized versions
      const imageRegex = /src="([^"]*\.(jpg|jpeg|png|gif))"/gi;
      
      content = content.replace(imageRegex, (match, imagePath) => {
        // Skip if already optimized or external
        if (imagePath.startsWith('http') || imagePath.includes('images-optimized')) {
          return match;
        }
        
        // Convert to optimized path
        const optimizedPath = imagePath.replace('/images/', '/images-optimized/');
        updated = true;
        
        return `src="${optimizedPath}"`;
      });
      
      if (updated) {
        fs.writeFileSync(htmlPath, content);
        console.log(`📝 Updated: ${htmlPath}`);
      }
      
    } catch (error) {
      console.warn(`⚠️  Could not update ${htmlPath}:`, error.message);
    }
  }
}

// Main execution
async function main() {
  const optimizer = new ImageOptimizer();
  
  const command = process.argv[2];
  const folderName = process.argv[3]; // Get folder name for optimizeFolder command
  
  switch (command) {
    case 'optimize':
      await optimizer.optimizeAllFolders();
      await optimizer.updateHtmlFiles();
      break;
      
    case 'optimize-folder':
      if (folderName) {
        await optimizer.optimizeFolder(folderName);
      } else {
        console.error('Please provide a folder name for the optimize-folder command.');
      }
      break;
      
    case 'update-html':
      await optimizer.updateHtmlFiles();
      break;
      
    default:
      console.log(`
🖼️  Image Optimizer

Usage:
  node optimize-images.js scripts/optimize              # Optimize all folders and update HTML
  node optimize-images.js scripts/optimize-folder <folder-name> # Optimize images in a specific folder

This will:
1. Create optimized WebP versions of all images
2. Update HTML files to use optimized images

Examples:
  node optimize-images.js optimize-folder kashgar
  node optimize-images.js optimize-folder mongolia
  node optimize-images.js optimize
      `);
  }
}

// Run the program
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ImageOptimizer; 