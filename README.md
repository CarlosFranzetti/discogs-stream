# 🎵 Discogs Vinyl Collection Streamer

> 🎧 **Your entire vinyl collection, right in your pocket.** 🔥

Dig through your existing records, browse your wantlist, and discover what you already own - anytime, anywhere. Turn your Discogs collection into a fully streamable music library! 📀✨

---

## ✨ Features

🎸 **Browse Your Collection** - Explore all the vinyl records you already own from Discogs  
📊 **CSV Import** - Load your collection and wantlist directly from CSV exports - no login required  
🔍 **Background Scraping** - Automatically finds YouTube audio and high-quality cover art for your tracks in the background  
💾 **Smart Persistence** - Saves all resolved metadata locally, so your collection loads instantly next time  
🎨 **Themes** - Choose from multiple themes (Default Dark, Midnight Purple, Vintage Green) to match your vibe  
🔀 **Shuffle Mode** - Seamlessly toggle between shuffled and sequential playback  
📱 **Mobile First** - Designed for on-the-go access with a smooth, app-like experience  
🎵 **YouTube & Bandcamp** - Dual playback providers for maximum compatibility  
❤️ **Like/Dislike Tracks** - Curate your listening experience with track preferences  

---

## 🚀 Getting Started

### Prerequisites
- Node.js & npm installed
- A Discogs account (optional, for OAuth)
- Supabase project (for backend services)

### Installation

```bash
# Clone the repo
git clone https://github.com/CarlosFranzetti/discogs-stream.git
cd discogs-stream

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY

# Start the development server
npm run dev
```

🎉 Open [http://localhost:8080](http://localhost:8080) and start streaming!

---

## 🛠️ Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | 🔥 Start development server (localhost:8080) |
| `npm run build` | 📦 Build for production |
| `npm run build:dev` | 🐛 Build for development mode |
| `npm run lint` | 🧹 Run linter |
| `npm test` | ✅ Run all tests |
| `npm preview` | 👀 Preview production build |

---

## 📂 Project Structure

```
src/
├── components/          # 🧩 React components
│   ├── ui/             # 🎨 shadcn-ui components
│   ├── Player.tsx      # 🖥️ Desktop player
│   └── MobilePlayer.tsx # 📱 Mobile-optimized player
├── hooks/              # 🎣 Custom React hooks
├── pages/              # 📄 Route components
├── lib/                # 🔧 Utilities
├── types/              # 📝 TypeScript types
└── integrations/       # 🔌 Supabase client
```

---

## 🎯 Key Technologies

- ⚡ **Vite** - Lightning-fast build tool
- ⚛️ **React 18** - UI framework
- 🎨 **Tailwind CSS + shadcn/ui** - Beautiful, accessible components
- 🗄️ **Supabase** - Backend & edge functions
- 🎵 **YouTube IFrame API** - Audio playback
- 🎶 **Bandcamp Embeds** - Alternative playback source
- 📀 **Discogs API** - Collection & release data

---

## 🌟 Recent Updates (Feb 2026)

✅ **Improved Background Verification** - The app now smartly prioritizes checking the track you are listening to, ensuring cover art and audio are ready when you need them  
🎨 **Visual Polish** - Smoother animations, fixed waveform glitches, and new color themes  
💾 **Offline-First Metadata** - CSV collections now behave like a native library, remembering every track you've matched  
🎵 **Intelligent Playback** - Enhanced "Next" track logic ensures music starts immediately without needing to hit play again  

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change. 💡

---

## 📜 License

This project is open source and available under the MIT License.

---

## 💖 Built With Love

*For vinyl lovers, by vinyl lovers.* 📀✨

**Happy Streaming!** 🎧🔥