# VoiceLedger AI 🎙️💰
**A Zero-Typing Smart Financial Ledger for Small Businesses.**

VoiceLedger AI is a mobile-first accounting solution designed for shopkeepers and individuals who find manual bookkeeping tedious. Using Google Gemini 2.5 Flash, it turns simple voice notes and photos of receipts into structured financial records.

## ✨ Key Features
- **Voice-First Interaction:** Simply hold the mic and speak. "Sold bread for 100" or "Paid 500 to Ali."
- **AI Context Logic:** The app intelligently distinguishes between **Sale (+)** (Income/Earnings) and **Debt (-)** (Spending/Giving money).
- **AI Bill Scanner:** Snap a photo of any receipt, and the AI extracts the total amount automatically.
- **API Key Rotation:** Built-in system that cycles through 5 different API keys to bypass free-tier quota limits (429 errors).
- **Multi-Currency Support:** Tailored for Pakistan (PKR), USA (USD), and India (INR) with localized language understanding (Urdu/Hindi mix).
- **Local Database:** Uses `AsyncStorage` to keep your financial data safe on your device.
- **Fully Accessible:** High-contrast UI with full Screen Reader support (`accessibilityLabels`).

## 🛠️ Tech Stack
- **Frontend:** React Native & Expo
- **AI Brain:** Google Gemini 2.5 Flash API (Multimodal)
- **Icons:** Lucide React Native
- **Storage:** React Native AsyncStorage
- **Audio/Vision:** Expo-AV & Expo-Image-Picker

## 🧠 How It Works (The Logic)
1. **The Voice Input:** `expo-av` records audio and converts it to Base64.
2. **The AI Prompt:** We send the audio/image to Gemini with a strict system instruction: 
   *"If user SOLD or EARNED, type is 'sale'. If user GAVE or SPENT, type is 'debt'. Return JSON ONLY."*
3. **The Data:** The app parses the JSON, updates the "Lifetime Wallet Balance," and stores it locally.

## ⚙️ Installation & Setup
1. Clone this repository:
   ```bash
   git clone https://github.com/BatoolIfrah03/VoiceLedger-AI.git
