# Yacht-Specific Welcome Videos

This document explains how to set up custom welcome videos for each yacht that play automatically when users scan QR codes.

## How It Works

When a user scans a yacht's QR code:
1. A fullscreen welcome video overlay appears immediately
2. The video plays automatically with the yacht name displayed
3. Users can skip to login at any time with the "Skip to Login" button
4. After the video completes, it automatically transitions to the login screen
5. If no yacht-specific video exists, the system proceeds directly to login

## Setting Up Welcome Videos

### Step 1: Prepare Your Video

Create a custom welcome video for each yacht. Best practices:
- Keep videos under 2 minutes for optimal user experience
- Use a clear, welcoming message
- Include important yacht-specific information
- Ensure good video quality (1080p recommended)

### Step 2: Upload to Education Videos

1. Log in to the dashboard as a staff member or master user
2. Navigate to the "Education" section
3. Click "Upload Video" button
4. Fill in the form:
   - **Title**: e.g., "Welcome to [Yacht Name]"
   - **Description**: Brief description of the video content
   - **Category**: Select "SignIn"
   - **Yacht**: Select the specific yacht this video is for
   - **Order Index**: Use 0 for primary welcome video
5. Upload your video file and optional thumbnail
6. Click "Upload Video"

### Step 3: Name Your Video File

For easy organization, name your video files with the yacht name:
- Example: `sea_breeze_welcome.mp4`
- Example: `ocean_star_welcome.mp4`

This makes it easier to identify videos in your storage.

## Video Requirements

- **Format**: MP4, WebM, or any browser-supported video format
- **Category**: Must be set to "SignIn"
- **Yacht Association**: Must be linked to a specific yacht
- **Size**: Maximum 5GB (as configured in storage buckets)

## User Experience Flow

### With QR Code Scan (Yacht-Specific Video Exists)

1. User scans yacht QR code
2. Fullscreen welcome video appears
3. Video shows yacht name and welcome message
4. "Skip to Login" button is always available
5. After video ends, login form appears with yacht banner
6. User logs in normally

### With QR Code Scan (No Yacht-Specific Video)

1. User scans yacht QR code
2. Proceeds directly to login screen
3. Yacht banner shows which yacht was scanned
4. User logs in normally
5. Generic education video (if available) shows below login form

### Without QR Code Scan

1. User navigates to sign-in page directly
2. Standard login form appears
3. Generic SignIn education video (if available) shows below login form

## Generic vs Yacht-Specific Videos

The system supports two types of SignIn videos:

### Generic SignIn Videos
- Not linked to any specific yacht (yacht_id is null)
- Appears below the login form for all non-QR code logins
- Use for general platform education

### Yacht-Specific Welcome Videos
- Linked to a specific yacht (yacht_id is set)
- Appears as fullscreen overlay when QR code is scanned
- Use for yacht-specific welcome messages

## Managing Multiple Videos

Each yacht can have multiple SignIn videos:
- Use the **order_index** field to set priority
- Video with lowest order_index (e.g., 0) will be shown
- This allows you to change welcome videos without deleting old ones

## Troubleshooting

### Video Doesn't Play After QR Scan

**Check:**
1. Video is uploaded and associated with the correct yacht
2. Video category is set to "SignIn"
3. Video file is accessible and not corrupted
4. Browser supports the video format

### Video Shows Error Message

The system will:
- Display "Video could not be loaded" message
- Automatically redirect to login after 2 seconds
- Ensure users can always access the login form

### Wrong Video Playing

**Verify:**
1. Only one video per yacht should have order_index of 0
2. Yacht association is correct in video metadata
3. No duplicate SignIn videos for the same yacht with same order_index

## Best Practices

1. **Keep Videos Short**: 30-90 seconds is ideal for welcome messages
2. **Test on Mobile**: Ensure videos display properly on phones and tablets
3. **Include Captions**: Consider adding text overlays for important information
4. **Update Regularly**: Refresh welcome videos seasonally or when yacht features change
5. **Monitor Storage**: Large video files consume storage space
6. **Provide Skip Option**: Users appreciate the ability to skip if in a hurry

## Technical Details

- Videos are stored in the `education-videos` storage bucket
- Video metadata is stored in the `education_videos` database table
- QR code parameters are captured from URL query string
- Yacht ID is stored in localStorage for post-login navigation
- Video player uses HTML5 video element with autoplay
- Fullscreen overlay uses fixed positioning with z-index 50
