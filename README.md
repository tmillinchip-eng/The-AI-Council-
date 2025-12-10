<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# The AI Council

A multi-perspective AI discussion panel featuring four distinct voices discussing AI and its future, particularly in education.

## The Council Members

This application features four AI personas based on prominent thinkers:

1. **The Godfather** (Geoffrey Hinton) - Deep Learning pioneer who now warns about AI risks
2. **The Anthropologist** (Bret Weinstein) - Evolutionary biologist examining AI through a societal lens
3. **The Techbro** (Sam Altman) - AGI accelerationist focused on scaling and deployment
4. **The Predictionist** (Ray Kurzweil) - Singularity architect predicting exponential growth

## Features

- **Multi-persona chat interface**: Ask questions and get responses from all four perspectives
- **Streaming responses**: Real-time streaming of AI-generated responses
- **Toggle personas**: Show/hide specific council members
- **Horizontal panel layout**: Each persona gets their own column
- **AI-powered by Google Gemini 2.5 Flash**

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set your Gemini API key in `.env.local`:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   Get your API key from: https://aistudio.google.com/apikey

3. Run the app:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:3000`

## Usage

Type your question about AI in the input field and press "Broadcast" to get responses from all active council members. Each persona will respond based on their unique perspective and expertise.

Example questions:
- "How will AI transform education in the next decade?"
- "What are the biggest risks of artificial intelligence?"
- "Will AI lead to abundance or unemployment?"
- "How close are we to AGI?"
