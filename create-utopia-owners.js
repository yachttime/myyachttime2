/**
 * Batch User Creation Script for UTOPIA Yacht Owners
 *
 * This script creates owner accounts for the UTOPIA yacht using their phone numbers as passwords.
 * Run this script with: node create-utopia-owners.js
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const YACHT_ID = 'e613ad93-c041-4e8c-859f-8526bcde2cc1'; // UTOPIA

// User data from the provided list (duplicates removed)
const users = [
  {
    name: 'Ralph Sorbonne',
    email: 'rlsorbonne@gmail.com',
    phone: '801-455-2001'
  },
  {
    name: 'Chip Brewster',
    email: 'brouha@hotmail.com',
    phone: '801-562-8801'
  },
  {
    name: 'Greg Brown',
    email: 'gregbrown646@gmail.com',
    phone: '801-652-6191'
  },
  {
    name: 'Jeff Flamm',
    email: 'jflamm@eyeqadvantage.com',
    phone: '801-209-8000'
  },
  {
    name: 'Wade Williams',
    email: 'wwisme@mac.com',
    phone: '801-556-2181'
  },
  {
    name: 'Dick Miles',
    email: 'dickm@wslm.biz',
    phone: '801-949-8530'
  },
  {
    name: 'Joe Ham',
    email: 'joeham7@gmail.com',
    phone: '714-408-6000'
  },
  {
    name: 'Rick Bartholomew',
    email: 'rickbart@reagan.com',
    phone: '8013809519'
  },
  {
    name: 'Curtis McEntire',
    email: 'curtis.mcentire@outlook.com',
    phone: '801-419-5251'
  },
  {
    name: 'Ken Webster',
    email: 'websterlisa@comcast.net',
    phone: '801-201-4377'
  },
  {
    name: 'Andrew Bartholomew',
    email: 'drewbart@reagan.com',
    phone: '801-960-0362'
  }
];

async function createUser(userData) {
  const [firstName, ...lastNameParts] = userData.name.split(' ');
  const lastName = lastNameParts.join(' ');

  // Use phone number as password (remove dashes)
  const password = userData.phone.replace(/[-\s]/g, '');

  const payload = {
    email: userData.email,
    password: password,
    first_name: firstName,
    last_name: lastName,
    phone: userData.phone,
    yacht_id: YACHT_ID,
    role: 'owner',
    email_notifications_enabled: true,
    sms_notifications_enabled: false
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✓ Created user: ${userData.name} (${userData.email})`);
      return { success: true, user: userData };
    } else {
      console.error(`✗ Failed to create ${userData.name}: ${result.error}`);
      return { success: false, user: userData, error: result.error };
    }
  } catch (error) {
    console.error(`✗ Error creating ${userData.name}:`, error);
    return { success: false, user: userData, error: error.message };
  }
}

async function batchCreateUsers() {
  console.log('Starting batch user creation for UTOPIA yacht...\n');
  console.log(`Total users to create: ${users.length}\n`);

  const results = {
    successful: [],
    failed: []
  };

  for (const user of users) {
    const result = await createUser(user);
    if (result.success) {
      results.successful.push(result.user);
    } else {
      results.failed.push({ user: result.user, error: result.error });
    }

    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n=== Batch Creation Complete ===');
  console.log(`Successful: ${results.successful.length}`);
  console.log(`Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('\nFailed Users:');
    results.failed.forEach(({ user, error }) => {
      console.log(`  - ${user.name} (${user.email}): ${error}`);
    });
  }

  console.log('\nAll users have been set with their phone number (without dashes) as their password.');
  console.log('They will be prompted to change their password on first login.');
}

// Check for required environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: Missing required environment variables');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file');
  process.exit(1);
}

// Run the batch creation
batchCreateUsers().catch(console.error);
