import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Environment Variables Check:');
console.log('================================');

const requiredVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const optionalVars = [
  'NODE_ENV',
  'PORT'
];

console.log('\n📋 Required Variables:');
requiredVars.forEach(varName => {
  const exists = !!process.env[varName];
  const value = process.env[varName];
  console.log(`${exists ? '✅' : '❌'} ${varName}: ${exists ? 'SET' : 'MISSING'}`);
  if (exists && varName === 'MONGODB_URI') {
    // Show partial URI for debugging without exposing credentials
    const uri = value!;
    const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    console.log(`   Preview: ${maskedUri.substring(0, 50)}...`);
  }
});

console.log('\n📋 Optional Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`${value ? '✅' : '⚠️'} ${varName}: ${value || 'NOT SET'}`);
});

const missingRequired = requiredVars.filter(varName => !process.env[varName]);
if (missingRequired.length > 0) {
  console.log('\n❌ Missing required environment variables:');
  missingRequired.forEach(varName => console.log(`   - ${varName}`));
  console.log('\n💡 Set these in your deployment platform or .env file');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set!');
}

