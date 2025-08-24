# YouTube API Setup Guide

## Why Use the Official YouTube API?

The official YouTube Data API v3 provides:
- ✅ Reliable access to captions/transcripts
- ✅ Works with all videos (including newly uploaded)
- ✅ Better error handling
- ✅ Access to video metadata
- ✅ No web scraping issues

## Setup Instructions

### 1. Get a YouTube API Key

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create a new project** (or select existing)
   - Click "Select a project" → "New Project"
   - Name it (e.g., "Nutritionist App")
   - Click "Create"

3. **Enable YouTube Data API v3**
   - Go to "APIs & Services" → "Library"
   - Search for "YouTube Data API v3"
   - Click on it and press "ENABLE"

4. **Create API Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "CREATE CREDENTIALS" → "API Key"
   - Copy the generated API key

5. **Restrict the API Key** (Recommended)
   - Click on your API key
   - Under "API restrictions", select "Restrict key"
   - Select "YouTube Data API v3"
   - Under "Application restrictions", you can add your domain
   - Click "Save"

### 2. Add API Key to Your App

Add to your `.env.local` file:

```env
YOUTUBE_API_KEY=your_api_key_here
```

### 3. API Quotas

The YouTube API has quotas:
- **Default**: 10,000 units per day
- **Caption list**: 50 units per request
- **Caption download**: 200 units per request

For most educational apps, this is more than sufficient.

## Using the API

### Option 1: With API Key (Simpler)
- Can list captions
- Can get video metadata
- **Cannot download caption content** (requires OAuth)

### Option 2: With OAuth (Full Access)
- Can list captions
- Can download full transcript content
- Can manage captions
- Requires user authentication

## Current Implementation

Our app supports both methods:

1. **Web Scraping** (Default)
   - No API key needed
   - May break with YouTube changes
   - Free and unlimited

2. **Official API** (When configured)
   - Requires API key
   - More reliable
   - Better for production

## Testing Your Setup

Once you have your API key:

1. Add it to `.env.local`
2. Restart your development server
3. In the admin panel, there will be an option to use the official API
4. Test with your video URL

## Troubleshooting

### "API access denied"
- Check your API key is correct
- Ensure YouTube Data API v3 is enabled in Google Cloud Console
- Check API key restrictions

### "Caption download not permitted"
- Caption download requires OAuth authentication
- For now, use the caption listing to verify transcripts exist
- Copy manually from YouTube if needed

### "Quota exceeded"
- You've hit the daily limit (10,000 units)
- Wait until the next day (quotas reset at midnight Pacific Time)
- Or request a quota increase in Google Cloud Console

## Alternative: Manual Transcript Management

If API setup is too complex, you can always:
1. Copy transcripts manually from YouTube
2. Paste into the admin panel
3. Let Claude AI process the content

## Need Help?

- Google Cloud Console: https://console.cloud.google.com/
- YouTube API Docs: https://developers.google.com/youtube/v3/docs/captions
- API Quotas: https://developers.google.com/youtube/v3/getting-started#quota