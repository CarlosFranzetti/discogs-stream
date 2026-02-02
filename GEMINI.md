# Discogs Vinyl Collection Streamer

**Project Overview**
A web application that allows users to browse and stream their vinyl collection. It integrates with Discogs to retrieve collection data and uses YouTube for playback. The application is built with a modern frontend stack and leverages Supabase for backend services.

**Key Technologies:**
-   **Frontend:** React, TypeScript, Vite
-   **Styling:** Tailwind CSS, shadcn-ui
-   **Backend:** Supabase (Database, Edge Functions, Auth)
-   **Testing:** Vitest

**Recent Changes (Feb 2026):**
-   **Enhanced Background Scraping:**
    *   Continuous verification of track metadata (YouTube Video ID and Cover Art).
    *   **Priority 1**: Currently playing track.
    *   **Priority 2**: Next 3 tracks in queue.
    *   **Priority 3**: Scans the rest of the list.
    *   **Smart Resolution**: Prioritizes Discogs metadata (Zero Quota cost) over YouTube Search API.
    *   **Cover Art Priority**: Prefers high-quality Discogs primary images; falls back to YouTube thumbnails only if Discogs art is missing.
    *   **Persistence**: Automatically updates and saves resolved metadata to `localStorage` for CSV tracks.
-   **Shuffle Mode**:
    *   Integrated shuffle toggle in player controls (Desktop & Mobile).
    *   Maintains current track position when toggling.
-   **Themes & Customization**:
    *   Added **Settings** menu with 3 Dark Mode themes: Default (Blue), Midnight (Purple), and Vintage (Green).
    *   **Dynamic Glow**: Record pulse animation color follows the active theme.
    *   **Smoother Animations**: 20s pulse cycle and fixed waveform vibration.
-   **Improved Playback**:
    *   Intelligent "Next" track logic ensures immediate playback.
    *   Automated fallback for blocked/unembeddable YouTube videos.

**Building and Running**

Prerequisites: Node.js (v18+ recommended) and npm.

1.  **Install Dependencies:** `npm install`
2.  **Start Dev Server:** `npm run dev` (Default: `http://localhost:8080`)
3.  **Build:** `npm run build`
4.  **Run Tests:** `npm run test`

**Development Conventions**

-   **Directory Structure:**
    -   `src/components`: UI components.
    -   `src/hooks`: Custom React hooks (e.g., `usePlayer`, `useBackgroundVerifier`, `useTrackMediaResolver`).
    -   `src/lib`: Core utility functions.
    -   `supabase/`: Edge Functions and DB migrations.
-   **Import Alias:** Use `@/` for `src/`.
-   **State Management:** React Query for server state; custom hooks/context for UI state.
-   **Backend**: Supabase Edge Functions proxy external APIs to secure keys and manage search quotas.
