## Inspiration
Many small shopkeepers and daily earners find it hard to type every single transaction into a phone. They often use old paper diaries which are easy to lose. I wanted to build something as fast as speaking like a "digital diary" that understands local languages and helps people manage their money without needing to be tech-experts.
## What it does
VoiceLedger AI is a smart money tracker. Instead of typing, you just hold a button and speak.
Voice Tracking: Say "Sold a shirt for 500" or "Paid 200 for tea" in English, Hindi, or Urdu.
Scan Receipts: Use the camera to scan a bill, and the AI finds the total automatically.
Smart Balance: It calculates your "Lifetime Balance" and shows daily sales (+) and debts (-).
Multi-Region: Works perfectly for users in Pakistan, India, and the USA with correct currency symbols.
## How we built it
The app is built using React Native and Expo.
AI Brain: We used the Gemini 2.5 Flash model to process both audio and images.
Audio: We used expo-av to record high-quality voice clips.
Data Storage: All transactions are saved locally on the phone using AsyncStorage so the data stays private.
Key Rotation: To keep the app free and reliable, we built a custom system to rotate between multiple API keys if one hits a limit.
## Challenges we ran into
The biggest challenge was making the AI understand mixed languages (like "Hinglish" or "Urdu-English"). We had to carefully design the "System Prompt" to ensure the AI always returns a clean JSON format. Handling high-quality audio files and converting them to Base64 for the AI to read was also a technical hurdle.
## Accomplishments that we're proud of
We are proud of the "One-Tap" experience. A user can record a transaction in under 3 seconds. We also successfully implemented a visual "Pulse" animation and a "Toast" error system that makes the app feel professional and alive.
## What we learned
I learned how to use Multimodal AI, which means using one AI model to handle voice, text, and photos at the same time. I also learned a lot about mobile accessibility and how to manage app state for a smooth user experience.
## What's next for VoiceLedger AI: Speak to Track Your Money
We want to add PDF Reports so users can print their monthly sales. We also plan to add "Offline Mode" using local on-device speech-to-text and a "Monthly Analytics" screen to show spending charts.
