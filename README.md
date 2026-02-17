# 🎵 Discogs Vinyl Collection Streamer

> 🎧 **Your entire vinyl collection, right in your pocket.** 🔥

Dig through your existing records, browse your wantlist, and discover what you already own - anytime, anywhere. Turn your Discogs collection into a fully streamable music library! 📀✨

---

## ✨ Features

🎸 **Browse Your Collection** - Explore all the vinyl records you already own from Discogs
📊 **CSV Import** - Load your collection and wantlist directly from CSV exports - no login required
🔍 **Background Scraping** - Automatically finds YouTube audio and high-quality cover art for every track in the background
💾 **Smart Persistence** - Saves all resolved metadata to the cloud database, so your collection loads instantly next time
🎨 **Themes** - Choose from multiple themes (Default Dark, Midnight Purple, Vintage Green) to match your vibe
🔀 **Smart Shuffle** - Toggle between shuffled and sequential (artist → album → track order) playback
🔎 **Playlist Search** - Live-filter your queue by title or artist right in the playlist panel
📱 **Mobile First** - Designed for on-the-go access with a smooth, app-like experience that fits any screen
🎵 **YouTube & Bandcamp** - Dual playback providers for maximum compatibility
❤️ **Like/Dislike Tracks** - Curate your listening experience with track preferences
🛡️ **Failsafe Audio Chain** - yt-dlp → Invidious → YouTube API ensures playback even when quotas run out
🔁 **Auto-Retry Unavailable Tracks** - Dimmed tracks retry in the background; tap once to queue the retry, tap again when resolved to play

---

## 🚀 Getting Started

### Prerequisites
- Node.js & npm installed
- A Discogs account (optional, for OAuth via Settings)
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
│   └── MobilePlayer.tsx # 📱 Mobile-optimized player (primary)
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
- 🗄️ **Supabase** - Backend, edge functions & persistent cloud cache
- 🎵 **YouTube IFrame API** - Audio playback
- 🎶 **Bandcamp Embeds** - Alternative playback source
- 📀 **Discogs API** - Collection & release data
- 🔧 **yt-dlp + Invidious** - Quota-free direct audio extraction

---

## 🌟 Recent Updates (Feb 2026)

🛡️ **Failsafe Audio Chain** - YouTube searches now always run through yt-dlp → Invidious → YouTube API, even after quota is exceeded. No more dead silence!
💾 **Cloud Persistence on Import** - CSV imports now write resolved YouTube IDs and cover art straight to the database. Reopen the app and everything is there instantly
🔀 **Sequential Shuffle** - Shuffle OFF now sorts your playlist by artist → album → track position. Toggle ON to randomize, toggle back OFF to restore the ordered view
🔎 **Playlist Search** - New search bar at the top of the playlist panel lets you filter your queue live by title or artist
🔁 **Smart Dimmed Tracks** - Tracks without a stream are dimmed (not removed). First tap triggers a silent background retry; second tap plays if it resolved. Background verifier also retries `non_working` tracks automatically over time
📱 **Cleaner Title Screen** - The "Connect via CSV files below or sign in" card is gone. Just upload your CSV and hit Start Listening
🎯 **Track Sync on Start** - If audio is already preloading when you tap Start Listening, the displayed track now correctly matches what's actually playing
⚙️ **Discogs OAuth in Settings** - Discogs account connection moved to the Settings panel (gear icon) with a clear experimental warning

---

## 📜 License

This project is open source and available under the MIT License.

---

## 💖 Built With Love

*For vinyl lovers, by vinyl lovers.* 📀✨

**Happy Streaming!** 🎧🔥
