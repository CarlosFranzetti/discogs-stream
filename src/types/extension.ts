import { Track } from './track';

export interface DiscogsRelease {
  id: number;
  title: string;
  artist: string;
  year: number;
  coverUrl: string;
  label?: string;
  genre?: string;
  country?: string;
  format?: string;
  numForSale?: number;
  lowestPrice?: number;
  masterUrl?: string;
}

export interface Crate {
  id: string;
  name: string;
  releases: DiscogsRelease[];
  createdAt: number;
  updatedAt: number;
  color?: string;
}

export interface ExtensionPlaylist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

export interface CartItem {
  releaseId: number;
  listingId?: number;
  title: string;
  artist: string;
  year?: number;
  coverUrl?: string;
  price?: number;
  currency?: string;
  seller?: string;
  sellerRating?: number;
  condition?: string;
  sleeveCondition?: string;
  shipsFrom?: string;
  comments?: string;
  addedAt: number;
}

export interface Cart {
  id: string;
  name: string;
  items: CartItem[];
  createdAt: number;
  updatedAt: number;
}

export interface MarketplaceListing {
  id: number;
  releaseId: number;
  title: string;
  artist: string;
  price: number;
  currency: string;
  condition: string;
  sleeveCondition?: string;
  seller: string;
  sellerRating?: number;
  shipsFrom?: string;
  comments?: string;
  uri: string;
  coverUrl?: string;
}

export interface MarketplaceStats {
  releaseId: number;
  numForSale: number;
  lowestPrice: number | null;
  currency: string;
  blockingBuyLink?: string;
}

export interface SellerSummary {
  seller: string;
  rating?: number;
  itemsAvailable: number;
  releases: number[];
  estimatedTotal: number;
  listings: MarketplaceListing[];
}

export interface SimilarRelease {
  id: number;
  title: string;
  artist: string;
  year: number;
  coverUrl: string;
  label?: string;
  genre?: string;
  style?: string;
  country?: string;
  numForSale?: number;
  lowestPrice?: number;
}

export interface ExtensionSettings {
  autoPlayOnDiscogs: boolean;
  hideYoutubeVideo: boolean;
  showRainbowPulse: boolean;
  autoLoadRelease: boolean;
  theme: string;
  defaultPitch: number;
  showActivityToasts: boolean;
  openReleaseInBrowser: boolean;
  enableMarketplace: boolean;
  enableSuggestions: boolean;
  defaultCurrency: string;
  pitchEnabled: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoPlayOnDiscogs: false,
  hideYoutubeVideo: true,
  showRainbowPulse: false,
  autoLoadRelease: true,
  theme: 'dark',
  defaultPitch: 0,
  showActivityToasts: true,
  openReleaseInBrowser: false,
  enableMarketplace: true,
  enableSuggestions: true,
  defaultCurrency: 'USD',
  pitchEnabled: true,
};

export interface PageReleaseInfo {
  releaseId: number;
  title: string;
  artist: string;
  coverUrl: string;
  year?: number;
  label?: string;
  genre?: string;
  url: string;
  isMaster?: boolean;
  masterId?: number;
}

export type TabId = 'player' | 'crates' | 'playlists' | 'cart' | 'wantlist' | 'collection' | 'suggestions' | 'settings';
