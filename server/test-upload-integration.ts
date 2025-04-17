import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// Sample XNO wallet address for testing (from Nano explorer examples)
const validWallet = 'nano_1ipx847tk8o46pwxt5qjdbncjqcbwcc1rrmqnkztrfjy5k7z4imsrata9est';

async function testContentUpload() {
  console.log('\n=== Testing Content Upload with Real XNO Integration ===\n');
  
  try {
    // First verify the wallet
    console.log('1. Verifying wallet address via API...');
    const walletResponse = await fetch('http://localhost:5000/api/wallet/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address: validWallet })
    });
    
    const walletResult = await walletResponse.json();
    console.log('Wallet verification result:', walletResult);
    
    if (!walletResult.valid) {
      throw new Error('Wallet verification failed');
    }
    
    // Create a test image for upload
    const testImagePath = path.join(process.cwd(), 'test-image.jpg');
    if (!fs.existsSync(testImagePath)) {
      // Create a simple test image if it doesn't exist
      console.log('2. Creating test image...');
      try {
        // Copy from an existing image in uploads folder if available
        const uploadsDir = path.join(process.cwd(), 'uploads');
        const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
        const imageFile = files.find(file => file.endsWith('.jpg') || file.endsWith('.png'));
        
        if (imageFile) {
          fs.copyFileSync(path.join(uploadsDir, imageFile), testImagePath);
          console.log('Used existing image from uploads folder');
        } else {
          // Create an empty file as fallback (this won't be a valid image, but works for test purposes)
          fs.writeFileSync(testImagePath, 'test image content');
          console.log('Created empty test file (not a real image)');
        }
      } catch (err) {
        console.error('Error creating test image:', err);
        throw new Error('Failed to create test image');
      }
    }
    
    // Upload the content
    console.log('3. Uploading content with verified wallet...');
    const form = new FormData();
    form.append('screenshot', fs.createReadStream(testImagePath));
    form.append('title', 'Test Screenshot from Integration Test');
    form.append('price', '0.01');
    form.append('wallet', validWallet);
    
    const uploadResponse = await fetch('http://localhost:5000/api/content/upload', {
      method: 'POST',
      body: form
    });
    
    if (uploadResponse.ok) {
      const uploadResult = await uploadResponse.json();
      console.log('Content upload successful:', uploadResult);
      
      // Check daily pool stats
      console.log('\n4. Checking daily pool stats...');
      const statsResponse = await fetch('http://localhost:5000/api/rewards/pool-stats');
      const statsResult = await statsResponse.json();
      console.log('Daily pool stats:', statsResult);
      
      // Check estimated earnings
      console.log('\n5. Checking estimated earnings for wallet...');
      const earningsResponse = await fetch('http://localhost:5000/api/rewards/estimated-earnings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ walletAddress: validWallet })
      });
      
      const earningsResult = await earningsResponse.json();
      console.log('Estimated earnings:', earningsResult);
    } else {
      const errorText = await uploadResponse.text();
      console.error('Upload failed:', errorText);
    }
    
    console.log('\n=== Content Upload Test Complete ===');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    // const testImagePath = path.join(process.cwd(), 'test-image.jpg');
    // if (fs.existsSync(testImagePath)) {
    //   fs.unlinkSync(testImagePath);
    // }
  }
}

// Run the test
testContentUpload().catch(console.error);