/**
 * Batch Trip Creation Script for UTOPIA Yacht
 *
 * This script creates yacht bookings for all UTOPIA owners based on the provided schedule.
 * Run this script with: node create-utopia-trips.js
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const YACHT_ID = 'e613ad93-c041-4e8c-859f-8526bcde2cc1'; // UTOPIA

// User ID mapping (from database query)
const userIdMap = {
  'Ralph Sorbonne': 'ca74c02c-6796-4c37-9714-f8ebbc4c9161',
  'Chip Brewster': '2e94ff98-2350-4601-8e87-0b9bfb1ee746',
  'Greg Brown': '800c9c14-c0b6-4810-ac7c-423de4fa4b66',
  'Jeff Flamm': '2a63e13e-d6b3-40fc-823c-6ee0fb609fd4',
  'Wade Williams': 'd0a68dc3-92ab-4551-a554-b78082e530d1',
  'Dick Miles': '49642af4-8917-4873-8252-9ff2d377a4ad',
  'Joe Ham': 'abc34e27-7c15-4d54-a963-b647a261fc30',
  'Rick Bartholomew': 'bb548b63-1b86-43bb-93cd-13bb77b76f8c',
  'Curtis McEntire': '9ca6ef32-02dd-44b5-b211-d2b3c0f43038',
  'Ken Webster': '4701d2db-4224-4792-95be-3bc0191fb26b',
  'Andrew Bartholomew': '7cea05b8-7026-4a0f-9e11-e5e3f2a2f086'
};

// Trip schedule from the provided list
const trips = [
  { checkOn: '2026-05-28', checkOff: '2026-06-03', owner: 'Ralph Sorbonne' },
  { checkOn: '2026-06-04', checkOff: '2026-06-10', owner: 'Chip Brewster' },
  { checkOn: '2026-06-11', checkOff: '2026-06-17', owner: 'Greg Brown' },
  { checkOn: '2026-06-18', checkOff: '2026-06-24', owner: 'Jeff Flamm' },
  { checkOn: '2026-06-25', checkOff: '2026-07-01', owner: 'Wade Williams' },
  { checkOn: '2026-07-02', checkOff: '2026-07-08', owner: 'Ralph Sorbonne' },
  { checkOn: '2026-07-09', checkOff: '2026-07-15', owner: 'Dick Miles' },
  { checkOn: '2026-07-16', checkOff: '2026-07-22', owner: 'Joe Ham' },
  { checkOn: '2026-07-23', checkOff: '2026-07-29', owner: 'Rick Bartholomew' },
  { checkOn: '2026-07-30', checkOff: '2026-08-06', owner: 'Curtis McEntire' },
  { checkOn: '2026-08-07', checkOff: '2026-08-13', owner: 'Ken Webster' },
  { checkOn: '2026-08-14', checkOff: '2026-08-20', owner: 'Rick Bartholomew' },
  { checkOn: '2026-08-21', checkOff: '2026-08-27', owner: 'Andrew Bartholomew' },
  { checkOn: '2026-08-28', checkOff: '2026-09-03', owner: 'Joe Ham' },
  { checkOn: '2026-09-04', checkOff: '2026-09-10', owner: 'Ken Webster' },
  { checkOn: '2026-09-11', checkOff: '2026-09-17', owner: 'Curtis McEntire' }
];

async function createTrip(trip) {
  const userId = userIdMap[trip.owner];

  if (!userId) {
    console.error(`✗ No user ID found for ${trip.owner}`);
    return { success: false, trip, error: 'User not found' };
  }

  // Create timestamps with 10am times (using UTC)
  const startDate = `${trip.checkOn}T10:00:00-06:00`; // 10am Mountain Time
  const endDate = `${trip.checkOff}T10:00:00-06:00`;

  const payload = {
    yacht_id: YACHT_ID,
    user_id: userId,
    start_date: startDate,
    end_date: endDate,
    departure_time: '10:00:00',
    arrival_time: '10:00:00',
    checked_in: false,
    checked_out: false,
    oil_change_needed: false
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/yacht_bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`✓ Created trip: ${trip.owner} (${trip.checkOn} to ${trip.checkOff})`);
      return { success: true, trip };
    } else {
      const error = await response.text();
      console.error(`✗ Failed to create trip for ${trip.owner}: ${error}`);
      return { success: false, trip, error };
    }
  } catch (error) {
    console.error(`✗ Error creating trip for ${trip.owner}:`, error);
    return { success: false, trip, error: error.message };
  }
}

async function batchCreateTrips() {
  console.log('Starting batch trip creation for UTOPIA yacht...\n');
  console.log(`Total trips to create: ${trips.length}\n`);

  const results = {
    successful: [],
    failed: []
  };

  for (const trip of trips) {
    const result = await createTrip(trip);
    if (result.success) {
      results.successful.push(result.trip);
    } else {
      results.failed.push({ trip: result.trip, error: result.error });
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n=== Batch Trip Creation Complete ===');
  console.log(`Successful: ${results.successful.length}`);
  console.log(`Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('\nFailed Trips:');
    results.failed.forEach(({ trip, error }) => {
      console.log(`  - ${trip.owner} (${trip.checkOn} to ${trip.checkOff}): ${error}`);
    });
  }

  console.log('\nAll trips have been created with:');
  console.log('  - Departure time: 10:00 AM');
  console.log('  - Arrival time: 10:00 AM');
  console.log('  - Mountain Time Zone (UTC-6)');
}

// Check for required environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: Missing required environment variables');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file');
  process.exit(1);
}

// Run the batch creation
batchCreateTrips().catch(console.error);
