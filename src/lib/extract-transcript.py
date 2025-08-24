#!/usr/bin/env python3
"""
YouTube Transcript Extractor
Uses youtube-transcript-api to extract transcripts from YouTube videos
"""

import sys
import json
import re
from youtube_transcript_api import YouTubeTranscriptApi

def extract_video_id(url):
    """Extract video ID from various YouTube URL formats"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
        r'youtube\.com\/watch\?.*v=([^&\n?#]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    # If no pattern matches, assume it's already a video ID
    return url

def get_transcript(video_url, languages=['en', 'en-US', 'en-GB']):
    """
    Extract transcript from YouTube video
    
    Args:
        video_url: YouTube video URL or video ID
        languages: List of language codes to try (in order of preference)
    
    Returns:
        Dictionary with transcript data or error information
    """
    try:
        # Extract video ID
        video_id = extract_video_id(video_url)
        
        # Create API instance
        api = YouTubeTranscriptApi()
        
        # Fetch transcript (it will automatically select the best available language)
        transcript_list = api.fetch(video_id)
        
        if not transcript_list:
            return {
                'success': False,
                'error': 'No transcript content found',
                'errorType': 'empty_transcript'
            }
        
        # Process transcript
        full_text = ' '.join([item.text for item in transcript_list])
        
        # Calculate total duration
        if transcript_list:
            last_item = transcript_list[-1]
            total_duration = last_item.start + getattr(last_item, 'duration', 0)
        else:
            total_duration = 0
        
        # Format items for output
        items = []
        for item in transcript_list:
            items.append({
                'text': item.text,
                'start': item.start,
                'duration': getattr(item, 'duration', 0)
            })
        
        # Try to get language info
        try:
            transcripts_info = api.list(video_id)
            # Extract language from the string representation
            if 'en' in str(transcripts_info):
                language = 'en'
            else:
                language = 'unknown'
        except:
            language = 'unknown'
        
        # Return successful result
        return {
            'success': True,
            'data': {
                'transcript': full_text,
                'items': items,
                'language': language,
                'duration': total_duration,
                'wordCount': len(full_text.split()),
                'videoId': video_id
            }
        }
        
    except Exception as e:
        # Handle various error types
        error_message = str(e)
        
        if 'TranscriptsDisabled' in error_message or 'disabled' in error_message.lower():
            return {
                'success': False,
                'error': 'Transcripts are disabled for this video',
                'errorType': 'transcripts_disabled'
            }
        elif 'VideoUnavailable' in error_message or 'unavailable' in error_message.lower():
            return {
                'success': False,
                'error': 'Video is unavailable (private, deleted, or region-locked)',
                'errorType': 'video_unavailable'
            }
        elif 'NoTranscriptFound' in error_message or 'no transcript' in error_message.lower():
            return {
                'success': False,
                'error': 'No transcript found for this video',
                'errorType': 'no_transcript_found'
            }
        else:
            return {
                'success': False,
                'error': f'Error extracting transcript: {error_message}',
                'errorType': 'unknown_error'
            }

def main():
    """Main function - handles command line usage"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'No video URL provided',
            'errorType': 'missing_url'
        }))
        sys.exit(1)
    
    video_url = sys.argv[1]
    
    # Optional: accept languages as second argument
    if len(sys.argv) > 2:
        languages = sys.argv[2].split(',')
    else:
        languages = ['en', 'en-US', 'en-GB', 'en-AU', 'en-CA']
    
    result = get_transcript(video_url, languages)
    
    # Output as JSON
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()