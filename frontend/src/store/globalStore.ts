import { create } from 'zustand';

interface GlobalStore {
  bannerMessage: string | null;
  setBannerMessage: (msg: string | null) => void;
}

export const useGlobalStore = create<GlobalStore>((set) => ({
  bannerMessage: null,
  setBannerMessage: (msg) => set({ bannerMessage: msg }),
}));
