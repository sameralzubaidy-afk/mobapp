/**
 * File: p2p-kids-marketplace/src/stores/userStore.ts
 * MODULE-03 NODE-006: User Store with Node Information
 *
 * Simple Zustand store for managing user state with node info
 */

import { create } from 'zustand';

export interface UserNode {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  node_id: string | null;
  node?: UserNode | null;
}

interface UserState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  clearUser: () => set({ user: null, loading: false }),
}));
