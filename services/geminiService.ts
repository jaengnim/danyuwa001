import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from "../types";

// Helper function to decode base64 string to Uint8Array
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper function to decode audio data
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const playAnnouncement = async ( 
  text: string,  
  voiceName: VoiceName, 
  onStart?: () => void, 
  onEnd?: () => void, 
  existingContext?: AudioContext 
) => { 
  try { 
    // Vite config의 define 설정을 통해 주입된 키를 사용
    const apiKey = process.env.API_KEY;
 
    if (!apiKey) { 
      const msg = "❌ API Key가 설정되지 않았습니다.\n배포 시 환경 변수가 제대로 주입되었는지 확인해주세요."; 
      console.error(msg); 
      alert(msg); 
      if (onEnd) onEnd(); 
      return; 
    } 
 
    const audioContext = existingContext || new (window.AudioContext || (window as any).webkitAudioContext)(); 
 
    if (audioContext.state === 'suspended') { 
      await audioContext.resume(); 
    } 
 
    const ai = new GoogleGenAI({ apiKey: apiKey }); 
     
    const response = await ai.models.generateContent({ 
      model: "gemini-2.5-flash-preview-tts", 
      contents: [{ parts: [{ text }] }], 
      config: { 
        responseModalities: [Modality.AUDIO], 
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { voiceName }, 
          }, 
        }, 
      }, 
    }); 
 
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data; 
 
    if (!base64Audio) { 
      throw new Error("Gemini로부터 오디오 데이터를 받지 못했습니다."); 
    } 
 
    const audioBuffer = await decodeAudioData( 
      decode(base64Audio), 
      audioContext, 
      24000, 
      1 
    ); 
 
    const source = audioContext.createBufferSource(); 
    source.buffer = audioBuffer; 
    source.connect(audioContext.destination); 
     
    source.onended = () => { 
      if (onEnd) onEnd(); 
      if (!existingContext) { 
        audioContext.close(); 
      } 
    }; 
 
    if (onStart) onStart(); 
    source.start(); 
 
  } catch (error: any) { 
    console.error("❌ 재생 오류:", error); 
    alert(`오류 발생:\n${error.message || JSON.stringify(error)}`); 
    if (onEnd) onEnd(); 
  } 
};