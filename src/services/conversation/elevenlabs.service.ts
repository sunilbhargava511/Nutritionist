import axios from 'axios';
import { Readable } from 'stream';

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  modelId?: string;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  };
}

export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private defaultVoiceId: string;
  private defaultModelId = 'eleven_monolingual_v1';

  constructor(config: ElevenLabsConfig) {
    this.apiKey = config.apiKey;
    this.defaultVoiceId = config.voiceId;
    if (config.modelId) {
      this.defaultModelId = config.modelId;
    }
  }

  async textToSpeech(
    text: string,
    voiceId?: string,
    options?: {
      modelId?: string;
      voiceSettings?: {
        stability?: number;
        similarityBoost?: number;
        style?: number;
        useSpeakerBoost?: boolean;
      };
    }
  ): Promise<Buffer> {
    const url = `${this.baseUrl}/text-to-speech/${voiceId || this.defaultVoiceId}`;
    
    const data = {
      text,
      model_id: options?.modelId || this.defaultModelId,
      voice_settings: options?.voiceSettings || {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.5,
        use_speaker_boost: true,
      },
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('ElevenLabs TTS Error:', error);
      throw new Error('Failed to generate speech');
    }
  }

  async textToSpeechStream(
    text: string,
    voiceId?: string,
    options?: {
      modelId?: string;
      voiceSettings?: {
        stability?: number;
        similarityBoost?: number;
        style?: number;
        useSpeakerBoost?: boolean;
      };
      optimizeStreamingLatency?: number;
    }
  ): Promise<Readable> {
    const url = `${this.baseUrl}/text-to-speech/${voiceId || this.defaultVoiceId}/stream`;
    
    const data = {
      text,
      model_id: options?.modelId || this.defaultModelId,
      voice_settings: options?.voiceSettings || {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.5,
        use_speaker_boost: true,
      },
      optimize_streaming_latency: options?.optimizeStreamingLatency || 0,
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        responseType: 'stream',
      });

      return response.data;
    } catch (error) {
      console.error('ElevenLabs TTS Stream Error:', error);
      throw new Error('Failed to generate speech stream');
    }
  }

  async getVoices() {
    const url = `${this.baseUrl}/voices`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      return response.data.voices;
    } catch (error) {
      console.error('ElevenLabs Get Voices Error:', error);
      throw new Error('Failed to fetch voices');
    }
  }

  async getVoiceSettings(voiceId: string) {
    const url = `${this.baseUrl}/voices/${voiceId}/settings`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      console.error('ElevenLabs Get Voice Settings Error:', error);
      throw new Error('Failed to fetch voice settings');
    }
  }

  async cloneVoice(
    name: string,
    files: Buffer[],
    description?: string,
    labels?: Record<string, string>
  ) {
    const url = `${this.baseUrl}/voices/add`;
    
    const formData = new FormData();
    formData.append('name', name);
    
    if (description) {
      formData.append('description', description);
    }
    
    if (labels) {
      formData.append('labels', JSON.stringify(labels));
    }
    
    files.forEach((file, index) => {
      formData.append('files', new Blob([file]), `sample_${index}.mp3`);
    });

    try {
      const response = await axios.post(url, formData, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      console.error('ElevenLabs Clone Voice Error:', error);
      throw new Error('Failed to clone voice');
    }
  }

  async deleteVoice(voiceId: string) {
    const url = `${this.baseUrl}/voices/${voiceId}`;
    
    try {
      const response = await axios.delete(url, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      console.error('ElevenLabs Delete Voice Error:', error);
      throw new Error('Failed to delete voice');
    }
  }

  async getUsage() {
    const url = `${this.baseUrl}/user`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      console.error('ElevenLabs Get Usage Error:', error);
      throw new Error('Failed to fetch usage');
    }
  }
}

export default ElevenLabsService;